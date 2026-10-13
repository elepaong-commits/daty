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

function requireR2() {
  if (!r2) throw new HttpError(503, "Photo storage is not configured", "STORAGE_DISABLED");
  return r2;
}

const DAY_MS = 86_400_000;
const UPLOAD_TTL_SECONDS = 10 * 60;

async function presign(key: string, method: "GET" | "PUT", expiresSeconds: number, datetime?: string) {
  const { client, bucketUrl } = requireR2();
  const url = new URL(`${bucketUrl}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  const signed = await client.sign(url.href, { method, aws: { signQuery: true, datetime } });
  return signed.url;
}

/** One-time URL the browser PUTs the image to; it must send the same `Content-Type`. */
export const presignUpload = (key: string) => presign(key, "PUT", UPLOAD_TTL_SECONDS);

/**
 * Signed GET for showing a photo. The signing time is pinned to the start of the UTC day so the URL
 * (and the browser's cached image) stays the same all day; two days of validity leaves at least
 * one full day after it is handed out.
 */
export function signedImageUrl(key: string) {
  const dayStart = new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS);
  return presign(key, "GET", (2 * DAY_MS) / 1000, dayStart.toISOString().replace(/[:-]|\.\d{3}/g, ""));
}

/** Size and type of an uploaded object, or `null` if nothing was uploaded under the key. */
export async function statObject(key: string) {
  const { client, bucketUrl } = requireR2();
  const res = await client.fetch(`${bucketUrl}/${key}`, { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 HEAD ${key} failed: ${res.status}`);
  return { size: Number(res.headers.get("content-length")), contentType: res.headers.get("content-type") ?? "" };
}

/** Best effort: a leftover object only costs storage, so failures are logged rather than surfaced. */
export async function deleteObjects(keys: string[]) {
  if (!r2 || keys.length === 0) return;
  const { client, bucketUrl } = r2;
  await Promise.all(
    keys.map(async (key) => {
      const res = await client.fetch(`${bucketUrl}/${key}`, { method: "DELETE" }).catch((err: unknown) => err);
      if (!(res instanceof Response) || (!res.ok && res.status !== 404)) {
        console.error(`R2 delete ${key} failed:`, res instanceof Response ? res.status : res);
      }
    }),
  );
}

/** API shape of a photo: uploaded ones get signed URLs, older rows keep their stored URL. */
export async function serializePhoto<T extends { storageKey: string | null; thumbnailKey: string | null; imageUrl: string | null }>({
  storageKey,
  thumbnailKey,
  imageUrl,
  ...photo
}: T) {
  const sign = (key: string) => (r2 ? signedImageUrl(key) : null);
  const full = storageKey ? await sign(storageKey) : imageUrl;
  // Photos uploaded before thumbnails existed fall back to the full image.
  return { ...photo, imageUrl: full, thumbnailUrl: thumbnailKey ? await sign(thumbnailKey) : full };
}

/** Every R2 object behind a photo, for deleting it. */
export const photoObjectKeys = (photo: { storageKey: string | null; thumbnailKey: string | null }) =>
  [photo.storageKey, photo.thumbnailKey].filter((key): key is string => key !== null);
