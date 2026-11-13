import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../middlewares/error-handler.js";
import {
  addComment,
  clearReaction,
  commentBody,
  deleteComment,
  feedbackInclude,
  loadFeedback,
  nicknameOf,
  reactionBody,
  setReaction,
} from "../lib/feedback.js";
import { idParam, toDateOnly } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { notifyPartner } from "../lib/push.js";
import {
  deleteObjects,
  photoObjectKeys,
  presignUpload,
  serializePhoto,
  signedDownloadUrl,
  statObject,
  storageEnabled,
} from "../lib/storage.js";

export const albumsRouter = Router();

const albumInclude = {
  photos: { orderBy: { displayOrder: "asc" }, include: feedbackInclude },
  records: {
    select: { id: true, category: true, place: { select: { id: true, name: true, address: true } } },
    orderBy: { scheduledAt: "asc" },
  },
} as const satisfies Prisma.AlbumInclude;

type AlbumWithRelations = Prisma.AlbumGetPayload<{ include: typeof albumInclude }>;

/** The distinct places of an album's visits, in visit order. */
const placesOf = (records: AlbumWithRelations["records"]) => [
  ...new Map(records.flatMap((r) => (r.place ? [[r.place.id, r.place]] : []))).values(),
];

async function serializeAlbum({ photos, records, ...album }: AlbumWithRelations) {
  const serialized = await Promise.all(photos.map(serializePhoto));
  const cover = serialized.find((p) => p.id === album.coverPhotoId) ?? serialized[0] ?? null;
  return {
    ...album,
    albumDate: toDateOnly(album.albumDate),
    albumEndDate: toDateOnly(album.albumEndDate ?? album.albumDate),
    photoCount: photos.length,
    coverPhoto: cover,
    category: records[0]?.category ?? null,
    places: placesOf(records),
    recordIds: records.map((r) => r.id),
    photos: serialized,
  };
}

// Saved places picked for the album become visit records on that day, which is how an album knows its places.
const placeVisits = {
  placeIds: z.array(z.number().int().positive()).max(20).optional(),
  // When those visits happened (the album's day, in the client's time zone).
  visitAt: z.iso.datetime({ offset: true }).optional(),
};

// `YYYY-MM`: a monthly album covers that whole month.
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const albumBody = z
  .object({
    title: z.string().trim().min(1).max(100),
    albumDate: z.iso.date().optional(),
    // Last day of a trip; leave out (or same as albumDate) for a one-day album.
    albumEndDate: z.iso.date().nullish(),
    // In place of the dates, for a month of everyday photos (home, usual spots).
    albumMonth: month.optional(),
    highlightNote: z.string().trim().max(300).nullish(),
    recordIds: z.array(z.number().int().positive()).max(50).optional(),
    ...placeVisits,
  })
  .refine((b) => (b.albumMonth === undefined) !== (b.albumDate === undefined), "Give albumDate or albumMonth");

/** Records a visit to each picked place not already in the album, promoting wish places to visited. */
async function addPlaceVisits(
  tx: Prisma.TransactionClient,
  { coupleId, writerId, albumId }: { coupleId: number; writerId: number; albumId: number },
  placeIds: number[],
  visitAt: string | undefined,
) {
  if (placeIds.length === 0) return;
  if (!visitAt) throw new HttpError(400, "visitAt is required with placeIds");
  const places = await tx.place.findMany({ where: { id: { in: placeIds }, coupleId } });
  if (places.length !== new Set(placeIds).size) throw new HttpError(404, "Place not found");
  const linked = await tx.dateRecord.findMany({ where: { albumId, placeId: { in: placeIds } }, select: { placeId: true } });
  const fresh = places.filter((place) => !linked.some((r) => r.placeId === place.id));
  await tx.dateRecord.createMany({
    data: fresh.map((place) => ({
      coupleId,
      writerId,
      albumId,
      placeId: place.id,
      type: "RECORD" as const,
      title: place.name,
      category: place.category,
      scheduledAt: new Date(visitAt),
    })),
  });
  await tx.place.updateMany({ where: { id: { in: fresh.map((p) => p.id) }, status: "WISH" }, data: { status: "VISITED" } });
}

// The list draws cards, so it carries the card's photos (cover first, up to three) and counts — not every
// photo with its reactions and comments, which only the album's own screen needs.
const PREVIEW_PHOTOS = 3;

albumsRouter.get("/", async (req, res) => {
  const { coupleId } = req;
  const [albums, counts] = await Promise.all([
    prisma.album.findMany({
      where: { coupleId },
      include: { ...albumInclude, photos: { orderBy: { displayOrder: "asc" }, take: PREVIEW_PHOTOS } },
      orderBy: [{ albumDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.photo.groupBy({ by: ["albumId", "mediaType"], where: { album: { coupleId } }, _count: { _all: true } }),
  ]);
  // A cover picked from further down the album isn't among the first photos.
  const missingCovers = albums.flatMap((a) =>
    a.coverPhotoId !== null && !a.photos.some((p) => p.id === a.coverPhotoId) ? [a.coverPhotoId] : [],
  );
  const covers = missingCovers.length
    ? await prisma.photo.findMany({ where: { id: { in: missingCovers }, album: { coupleId } } })
    : [];
  const countOf = (albumId: number, mediaType?: string) =>
    counts
      .filter((c) => c.albumId === albumId && (mediaType === undefined || c.mediaType === mediaType))
      .reduce((sum, c) => sum + c._count._all, 0);

  res.json(
    await Promise.all(
      albums.map(async ({ photos, records, ...album }) => {
        const cover = photos.find((p) => p.id === album.coverPhotoId) ?? covers.find((p) => p.id === album.coverPhotoId);
        const preview = cover ? [cover, ...photos.filter((p) => p.id !== cover.id)].slice(0, PREVIEW_PHOTOS) : photos;
        const previewPhotos = await Promise.all(preview.map(serializePhoto));
        return {
          ...album,
          albumDate: toDateOnly(album.albumDate),
          albumEndDate: toDateOnly(album.albumEndDate ?? album.albumDate),
          photoCount: countOf(album.id),
          videoCount: countOf(album.id, "VIDEO"),
          coverPhoto: previewPhotos[0] ?? null,
          category: records[0]?.category ?? null,
          places: placesOf(records),
          recordIds: records.map((r) => r.id),
          previewPhotos,
        };
      }),
    ),
  );
});

albumsRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const album = await prisma.album.findFirstOrThrow({
    where: { id, coupleId: req.coupleId },
    include: albumInclude,
  });
  res.json(await serializeAlbum(album));
});

/** An album covers albumDate..albumEndDate; a one-day album stores no end. */
function albumRange(start: Date, end: Date | null) {
  if (end && end < start) throw new HttpError(400, "albumEndDate must not be before albumDate");
  return { albumDate: start, albumEndDate: end && end > start ? end : null, monthly: false };
}

/** A monthly album spans its month's first to last day. */
function monthRange(albumMonth: string) {
  const [year, monthIndex] = albumMonth.split("-").map(Number) as [number, number];
  return { albumDate: new Date(Date.UTC(year, monthIndex - 1, 1)), albumEndDate: new Date(Date.UTC(year, monthIndex, 0)), monthly: true };
}

/**
 * One album per day: a day's dates and photos all go into the album that already holds that day.
 * Monthly albums keep everyday photos beside those, so they neither hold days nor clash with each other.
 */
async function assertDaysFree(
  tx: Prisma.TransactionClient,
  coupleId: number,
  { albumDate, albumEndDate, monthly }: { albumDate: Date; albumEndDate: Date | null; monthly: boolean },
  exceptId?: number,
) {
  if (monthly) return;
  const end = albumEndDate ?? albumDate;
  const taken = await tx.album.findFirst({
    where: {
      coupleId,
      monthly: false,
      ...(exceptId && { id: { not: exceptId } }),
      albumDate: { lte: end },
      OR: [{ albumEndDate: null, albumDate: { gte: albumDate } }, { albumEndDate: { gte: albumDate } }],
    },
    select: { id: true },
  });
  if (taken) throw new HttpError(409, "That day already has an album", "ALBUM_EXISTS");
}

albumsRouter.post("/", async (req, res) => {
  const { recordIds = [], placeIds = [], visitAt, albumDate, albumEndDate, albumMonth, ...data } = albumBody.parse(req.body);
  const { coupleId } = req;
  const range = albumMonth
    ? monthRange(albumMonth)
    : albumRange(new Date(albumDate!), albumEndDate ? new Date(albumEndDate) : null);
  const album = await prisma.$transaction(async (tx) => {
    const owned = await tx.dateRecord.count({ where: { id: { in: recordIds }, coupleId } });
    if (owned !== new Set(recordIds).size) throw new HttpError(404, "Record not found");
    await assertDaysFree(tx, coupleId, range);
    const { id } = await tx.album.create({
      data: {
        ...data,
        ...range,
        coupleId,
        records: { connect: recordIds.map((id) => ({ id })) },
      },
    });
    await addPlaceVisits(tx, { coupleId, writerId: req.userId, albumId: id }, placeIds, visitAt);
    return tx.album.findUniqueOrThrow({ where: { id }, include: albumInclude });
  });
  res.status(201).json(await serializeAlbum(album));
});

const updateBody = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  albumDate: z.iso.date().optional(),
  // null makes it a one-day album again.
  albumEndDate: z.iso.date().nullable().optional(),
  // Makes it a monthly album for that month; dates turn it back into a dated one.
  albumMonth: month.optional(),
  highlightNote: z.string().trim().max(300).nullable().optional(),
  // The "best cut" shown on the album card; must be one of this album's photos.
  coverPhotoId: z.number().int().positive().nullable().optional(),
  // Replaces the visits bundled into the album; each must be free or already in this album.
  recordIds: z.array(z.number().int().positive()).max(50).optional(),
  ...placeVisits,
});

albumsRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { recordIds, placeIds = [], visitAt, albumDate, albumEndDate, albumMonth, ...data } = updateBody.parse(req.body);
  const { coupleId } = req;
  const current = await prisma.album.findFirstOrThrow({ where: { id, coupleId } });
  const moving = albumDate !== undefined || albumEndDate !== undefined;
  if (albumMonth && moving) throw new HttpError(400, "Give albumDate or albumMonth, not both");
  // A month's span isn't a trip, so leaving it takes a start day.
  if (current.monthly && moving && !albumDate) throw new HttpError(400, "albumDate is required to leave a monthly album");
  let range: ReturnType<typeof albumRange> | undefined;
  if (albumMonth) {
    range = monthRange(albumMonth);
  } else if (moving) {
    const start = albumDate ? new Date(albumDate) : current.albumDate;
    // A new start alone keeps the old end when it still comes after it, otherwise the album shrinks to that day.
    // A month's last day isn't a trip's end, so a monthly album becomes one day.
    const end =
      albumEndDate !== undefined
        ? albumEndDate ? new Date(albumEndDate) : null
        : !current.monthly && current.albumEndDate && current.albumEndDate > start
          ? current.albumEndDate
          : null;
    range = albumRange(start, end);
  }
  if (data.coverPhotoId) {
    await prisma.photo.findFirstOrThrow({ where: { id: data.coverPhotoId, albumId: id } });
  }
  const album = await prisma.$transaction(async (tx) => {
    if (recordIds) {
      const owned = await tx.dateRecord.count({
        where: { id: { in: recordIds }, coupleId, OR: [{ albumId: null }, { albumId: id }] },
      });
      if (owned !== new Set(recordIds).size) throw new HttpError(404, "Record not found");
    }
    if (range) await assertDaysFree(tx, coupleId, range, id);
    await tx.album.update({
      where: { id },
      data: {
        ...data,
        ...range,
        ...(recordIds && { records: { set: recordIds.map((recordId) => ({ id: recordId })) } }),
      },
    });
    await addPlaceVisits(tx, { coupleId, writerId: req.userId, albumId: id }, placeIds, visitAt);
    return tx.album.findUniqueOrThrow({ where: { id }, include: albumInclude });
  });
  res.json(await serializeAlbum(album));
});

// Photo and video upload (CLAUDE.md "이미지 업로드 패턴"): the browser asks for presigned URLs, PUTs each file
// (and a small JPEG thumbnail of it, a video's first frame) straight to R2, then reports the keys back here.

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
// Videos are uploaded as shot (browsers can't reliably re-encode them), so the only cap is R2's single PUT.
const MAX_VIDEO_BYTES = 5 * 1000 ** 3;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const PHOTOS_PER_REQUEST = 30;
const extensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
} as const;
const videoExtension = /\.(mp4|mov|webm)$/;

const albumPhotoKey = (coupleId: number, albumId: number) =>
  new RegExp(`^couples/${coupleId}/albums/${albumId}/[0-9a-f-]{36}\\.(jpg|png|webp|mp4|mov|webm)$`);

/** The thumbnail sits next to its photo: `{uuid}.jpg` → `{uuid}.thumb.jpg`. */
const thumbnailKeyFor = (key: string) => key.replace(/\.\w+$/, ".thumb.jpg");

const uploadBody = z.object({
  files: z
    .array(z.object({ contentType: z.enum(Object.keys(extensions) as (keyof typeof extensions)[]) }))
    .min(1)
    .max(PHOTOS_PER_REQUEST),
});

albumsRouter.post("/:id/photos/uploads", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { files } = uploadBody.parse(req.body);
  const { coupleId } = req;
  await prisma.album.findFirstOrThrow({ where: { id, coupleId } });
  const uploads = await Promise.all(
    files.map(async ({ contentType }) => {
      const key = `couples/${coupleId}/albums/${id}/${randomUUID()}.${extensions[contentType]}`;
      const thumbnailKey = thumbnailKeyFor(key);
      return {
        key,
        uploadUrl: await presignUpload(key),
        headers: { "Content-Type": contentType },
        thumbnail: { key: thumbnailKey, uploadUrl: await presignUpload(thumbnailKey), headers: { "Content-Type": "image/jpeg" } },
      };
    }),
  );
  res.json({ uploads });
});

const addPhotosBody = z.object({
  photos: z
    .array(
      z.object({
        key: z.string().max(200),
        // Optional: if only the thumbnail upload failed, the photo is still kept and shown full size.
        thumbnailKey: z.string().max(200).nullish(),
        takenAt: z.iso.datetime({ offset: true }).nullish(),
        durationSec: z.number().positive().max(86_400).nullish(), // videos only
        // SHA-256 of the original file, so picking the same shot again doesn't add it twice.
        fingerprint: z.string().regex(/^[0-9a-f]{64}$/).nullish(),
      }),
    )
    .min(1)
    .max(PHOTOS_PER_REQUEST),
});

albumsRouter.post("/:id/photos", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { photos } = addPhotosBody.parse(req.body);
  const { coupleId } = req;
  const keyPattern = albumPhotoKey(coupleId, id);
  const knownKeys = photos.every((p) => keyPattern.test(p.key) && (!p.thumbnailKey || p.thumbnailKey === thumbnailKeyFor(p.key)));
  if (!knownKeys) throw new HttpError(400, "Unknown photo key", "INVALID_UPLOAD");
  await prisma.album.findFirstOrThrow({ where: { id, coupleId } });

  // Files already in the album (or twice in this request) are dropped along with their uploads.
  // The same key coming back is a retried confirm, not a duplicate, so it isn't deleted.
  const fingerprints = photos.flatMap((p) => (p.fingerprint ? [p.fingerprint] : []));
  const existing = await prisma.photo.findMany({
    where: { albumId: id, fingerprint: { in: fingerprints } },
    select: { fingerprint: true, storageKey: true },
  });
  const keyByFingerprint = new Map(existing.map((p) => [p.fingerprint, p.storageKey]));
  const fresh = photos.filter((p) => {
    if (!p.fingerprint) return true;
    const known = keyByFingerprint.get(p.fingerprint);
    if (known !== undefined) return known === p.key;
    keyByFingerprint.set(p.fingerprint, p.key);
    return true;
  });
  const duplicates = photos.filter((p) => !fresh.includes(p));
  if (duplicates.length > 0) await deleteObjects(duplicates.flatMap((p) => [p.key, ...(p.thumbnailKey ? [p.thumbnailKey] : [])]));

  // The presigned PUT can't cap size or type, so check what actually landed before recording it.
  const items = fresh.map((p) => ({ ...p, isVideo: videoExtension.test(p.key) }));
  const objects = items.flatMap((p) => [
    p.isVideo ? { key: p.key, maxBytes: MAX_VIDEO_BYTES, type: "video/" } : { key: p.key, maxBytes: MAX_PHOTO_BYTES, type: "image/" },
    ...(p.thumbnailKey ? [{ key: p.thumbnailKey, maxBytes: MAX_THUMBNAIL_BYTES, type: "image/" }] : []),
  ]);
  const stats = await Promise.all(objects.map((o) => statObject(o.key)));
  const valid = stats.every((s, i) => s && s.size <= objects[i]!.maxBytes && s.contentType.startsWith(objects[i]!.type));
  if (!valid) {
    await deleteObjects(objects.filter((_, i) => stats[i]).map((o) => o.key));
    throw new HttpError(400, "Upload missing, of the wrong type or too large", "INVALID_UPLOAD");
  }

  // What each file takes up in R2 (the original plus its thumbnail), for the storage meter.
  const sizeByKey = new Map(objects.map((o, i) => [o.key, stats[i]!.size]));
  const album = await prisma.$transaction(async (tx) => {
    const { _max } = await tx.photo.aggregate({ where: { albumId: id }, _max: { displayOrder: true } });
    const start = (_max.displayOrder ?? 0) + 1;
    await tx.photo.createMany({
      data: items.map((p, i) => ({
        albumId: id,
        storageKey: p.key,
        thumbnailKey: p.thumbnailKey ?? null,
        displayOrder: start + i,
        takenAt: p.takenAt ? new Date(p.takenAt) : null,
        mediaType: p.isVideo ? ("VIDEO" as const) : ("PHOTO" as const),
        durationSec: p.isVideo ? (p.durationSec ?? null) : null,
        fingerprint: p.fingerprint ?? null,
        sizeBytes: sizeByKey.get(p.key)! + (p.thumbnailKey ? sizeByKey.get(p.thumbnailKey)! : 0),
      })),
      skipDuplicates: true, // a retried confirm shouldn't fail on keys it already recorded
    });
    return tx.album.findUniqueOrThrow({ where: { id }, include: albumInclude });
  });
  res.status(201).json(await serializeAlbum(album));
});

const photoParams = z.object({ id: z.coerce.number().int().positive(), photoId: z.coerce.number().int().positive() });

// Saving the whole album: one link per file that downloads it under a readable name
// (`2026-10-04-003.jpg`). Files still go straight from R2 to the browser.
albumsRouter.get("/:id/photos/downloads", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const album = await prisma.album.findFirstOrThrow({
    where: { id, coupleId: req.coupleId },
    include: { photos: { orderBy: { displayOrder: "asc" } } },
  });
  const day = toDateOnly(album.albumDate);
  const files = await Promise.all(
    album.photos.map(async (photo, i) => {
      const extension = /\.(\w+)$/.exec(photo.storageKey ?? "")?.[1] ?? "jpg";
      const filename = `${day}-${String(i + 1).padStart(3, "0")}.${extension}`;
      const url = photo.storageKey && storageEnabled ? await signedDownloadUrl(photo.storageKey, filename) : photo.imageUrl;
      return { photoId: photo.id, mediaType: photo.mediaType, filename, url };
    }),
  );
  res.json({ files: files.filter((f) => f.url !== null) });
});

// Reactions and comments on a photo or video. Every call answers with the photo's feedback as it now stands.

async function photoTarget(req: { params: unknown; coupleId: number }) {
  const { id, photoId } = photoParams.parse(req.params);
  await prisma.photo.findFirstOrThrow({ where: { id: photoId, albumId: id, album: { coupleId: req.coupleId } }, select: { id: true } });
  return { albumId: id, target: { photoId } };
}

albumsRouter.put("/:id/photos/:photoId/reaction", async (req, res) => {
  const { albumId, target } = await photoTarget(req);
  const { emoji } = reactionBody.parse(req.body);
  await setReaction(req.coupleId, req.userId, target, emoji);
  const nickname = await nicknameOf(req.userId);
  notifyPartner(req.coupleId, req.userId, (locale) => ({
    title: locale === "ja" ? `${nickname}さんが写真に${emoji}` : `${nickname}님이 사진에 ${emoji}`,
    body: "",
    url: `/albums/${albumId}`,
    tag: `photo-reaction-${target.photoId}`,
  }));
  res.json(await loadFeedback(target));
});

albumsRouter.delete("/:id/photos/:photoId/reaction", async (req, res) => {
  const { target } = await photoTarget(req);
  await clearReaction(req.userId, target);
  res.json(await loadFeedback(target));
});

albumsRouter.post("/:id/photos/:photoId/comments", async (req, res) => {
  const { albumId, target } = await photoTarget(req);
  const { content } = commentBody.parse(req.body);
  await addComment(req.coupleId, req.userId, target, content);
  const nickname = await nicknameOf(req.userId);
  notifyPartner(req.coupleId, req.userId, (locale) => ({
    title: locale === "ja" ? `${nickname}さんが写真にコメント` : `${nickname}님이 사진에 댓글을 남겼어요`,
    body: content,
    url: `/albums/${albumId}`,
  }));
  res.status(201).json(await loadFeedback(target));
});

albumsRouter.delete("/:id/photos/:photoId/comments/:commentId", async (req, res) => {
  const { target } = await photoTarget(req);
  const { commentId } = z.object({ commentId: z.coerce.number().int().positive() }).parse(req.params);
  await deleteComment(req.userId, target, commentId);
  res.json(await loadFeedback(target));
});

albumsRouter.delete("/:id/photos/:photoId", async (req, res) => {
  const { id, photoId } = photoParams.parse(req.params);
  const photo = await prisma.$transaction(async (tx) => {
    const album = await tx.album.findFirstOrThrow({ where: { id, coupleId: req.coupleId } });
    const deleted = await tx.photo.delete({ where: { id: photoId, albumId: id } });
    if (album.coverPhotoId === photoId) await tx.album.update({ where: { id }, data: { coverPhotoId: null } });
    return deleted;
  });
  await deleteObjects(photoObjectKeys(photo));
  res.status(204).end();
});

albumsRouter.delete("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const album = await prisma.album.delete({
    where: { id, coupleId: req.coupleId },
    include: { photos: { select: { storageKey: true, thumbnailKey: true } } },
  });
  await deleteObjects(album.photos.flatMap(photoObjectKeys));
  res.status(204).end();
});
