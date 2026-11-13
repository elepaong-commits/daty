import { AwsClient } from "aws4fetch";
import { env } from "../config/env.js";
import { HttpError } from "../middlewares/error-handler.js";

// Photos live in a private R2 bucket. Browsers upload with a presigned PUT and view with a presigned GET,
// so image bytes never pass through this server.

const r2 =
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET
    ? {
        client: new AwsClient({
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          service: "s3",
          region: "auto",
        }),
        bucketUrl: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`,
      }
    : null;

/** Whether photo storage is set up; without it uploads answer 503 and photos have no URLs. */
export const storageEnabled = r2 !== null;

function requireR2() {
  if (!r2) throw new HttpError(503, "Photo storage is not configured", "STORAGE_DISABLED");
  return r2;
}

const DAY_MS = 86_400_000;
const UPLOAD_TTL_SECONDS = 10 * 60;

async function presign(
  key: string,
  method: "GET" | "PUT",
  expiresSeconds: number,
  { datetime, query = {} }: { datetime?: string; query?: Record<string, string> } = {},
) {
  const { client, bucketUrl } = requireR2();
  const url = new URL(`${bucketUrl}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  const signed = await client.sign(url.href, { method, aws: { signQuery: true, datetime } });
  return signed.url;
}

/** One-time URL the browser PUTs the image to; it must send the same `Content-Type`. */
export const presignUpload = (key: string) => presign(key, "PUT", UPLOAD_TTL_SECONDS);

// Photo URLs are signed for a pinned time, so the URL — and the browser's cached copy — stays the same
// for a while. They turn over every 6 days at 19:00 UTC (4 a.m. in Korea and Japan, when nobody is
// looking) and are signed for 7 days, the SigV4 maximum: a URL is good for at least a day after it was last handed out.
const IMAGE_WINDOW_MS = 6 * DAY_MS;
const IMAGE_WINDOW_OFFSET_MS = 19 * 60 * 60 * 1000;
const IMAGE_TTL_SECONDS = (7 * DAY_MS) / 1000;

/** When photo URLs handed out at `now` are signed: the start of the current window. */
export const imageSigningTime = (now = Date.now()) =>
  new Date(Math.floor((now - IMAGE_WINDOW_OFFSET_MS) / IMAGE_WINDOW_MS) * IMAGE_WINDOW_MS + IMAGE_WINDOW_OFFSET_MS);

/** Signed GET for showing a photo; the same URL for the whole window (see above). */
export function signedImageUrl(key: string) {
  const datetime = imageSigningTime().toISOString().replace(/[:-]|\.\d{3}/g, "");
  return presign(key, "GET", IMAGE_TTL_SECONDS, { datetime });
}

/** Signed GET that makes the browser save the file under `filename` instead of showing it. Good for an hour. */
export const signedDownloadUrl = (key: string, filename: string) =>
  presign(key, "GET", 60 * 60, { query: { "response-content-disposition": `attachment; filename="${filename}"` } });

export interface StoredObject {
  key: string;
  lastModified: Date;
}

const xmlText = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Every object under `prefix`, a page (up to 1000) at a time, so a big bucket isn't held in memory at once. */
export async function* listObjects(prefix: string): AsyncGenerator<StoredObject[]> {
  const { client, bucketUrl } = requireR2();
  let token: string | undefined;
  do {
    const url = new URL(bucketUrl);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    if (token) url.searchParams.set("continuation-token", token);
    const res = await client.fetch(url.href);
    if (!res.ok) throw new Error(`R2 list ${prefix} failed: ${res.status}`);
    const xml = await res.text();
    yield [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, entry]) => ({
      key: xmlText(/<Key>([\s\S]*?)<\/Key>/.exec(entry!)![1]!),
      lastModified: new Date(/<LastModified>(.*?)<\/LastModified>/.exec(entry!)![1]!),
    }));
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? xmlText(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "") || undefined
      : undefined;
  } while (token);
}

/** Size and type of an uploaded object, or `null` if nothing was uploaded under the key. */
export async function statObject(key: string) {
  const { client, bucketUrl } = requireR2();
  const res = await client.fetch(`${bucketUrl}/${key}`, { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD ${key} failed: ${res.status}`);
  return { size: Number(res.headers.get("content-length")), contentType: res.headers.get("content-type") ?? "" };
}

// A whole couple's files can be thousands; a few at a time keeps sockets and memory in check.
const DELETE_BATCH = 20;

/** Best effort: a leftover object only costs storage, so failures are logged rather than surfaced. */
export async function deleteObjects(keys: string[]) {
  if (!r2 || keys.length === 0) return;
  for (let i = 0; i < keys.length; i += DELETE_BATCH) await deleteBatch(r2, keys.slice(i, i + DELETE_BATCH));
}

async function deleteBatch({ client, bucketUrl }: NonNullable<typeof r2>, keys: string[]) {
  await Promise.all(
    keys.map(async (key) => {
      const res = await client.fetch(`${bucketUrl}/${key}`, { method: "DELETE" }).catch((err: unknown) => err);
      if (!(res instanceof Response) || (!res.ok && res.status !== 404)) {
        console.error(`R2 delete ${key} failed:`, res instanceof Response ? res.status : res);
      }
    }),
  );
}

/**
 * API shape of a photo or video: uploaded ones get signed URLs, older rows keep their stored URL.
 * For a video `imageUrl` is the video itself and `thumbnailUrl` its first frame.
 */
export async function serializePhoto<
  T extends {
    storageKey: string | null;
    thumbnailKey: string | null;
    imageUrl: string | null;
    mediaType: string;
    sizeBytes: bigint | null;
  },
>({ storageKey, thumbnailKey, imageUrl, sizeBytes, ...photo }: T) {
  const sign = (key: string) => (r2 ? signedImageUrl(key) : null);
  const full = storageKey ? await sign(storageKey) : imageUrl;
  // Photos uploaded before thumbnails existed fall back to the full image; a video can't stand in for one.
  const fallback = photo.mediaType === "VIDEO" ? null : full;
  return {
    ...photo,
    // BigInt doesn't go through JSON; a file is far below where a double loses whole bytes.
    sizeBytes: sizeBytes === null ? null : Number(sizeBytes),
    imageUrl: full,
    thumbnailUrl: thumbnailKey ? await sign(thumbnailKey) : fallback,
  };
}

/** Every R2 object behind a photo, for deleting it. */
export const photoObjectKeys = (photo: { storageKey: string | null; thumbnailKey: string | null }) =>
  [photo.storageKey, photo.thumbnailKey].filter((key): key is string => key !== null);
