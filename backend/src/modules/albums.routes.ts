import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../middlewares/error-handler.js";
import { idParam, toDateOnly } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { deleteObjects, photoObjectKeys, presignUpload, serializePhoto, statObject } from "../lib/storage.js";

export const albumsRouter = Router();

const albumInclude = {
  photos: { orderBy: { displayOrder: "asc" } },
  records: {
    select: { id: true, category: true, place: { select: { id: true, name: true, address: true } } },
    orderBy: { scheduledAt: "asc" },
  },
} as const satisfies Prisma.AlbumInclude;

type AlbumWithRelations = Prisma.AlbumGetPayload<{ include: typeof albumInclude }>;

async function serializeAlbum({ photos, records, ...album }: AlbumWithRelations) {
  const serialized = await Promise.all(photos.map(serializePhoto));
  const cover = serialized.find((p) => p.id === album.coverPhotoId) ?? serialized[0] ?? null;
  const places = [...new Map(records.flatMap((r) => (r.place ? [[r.place.id, r.place]] : []))).values()];
  return {
    ...album,
    albumDate: toDateOnly(album.albumDate),
    photoCount: photos.length,
    coverPhoto: cover,
    category: records[0]?.category ?? null,
    places,
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

const albumBody = z.object({
  title: z.string().trim().min(1).max(100),
  albumDate: z.iso.date(),
  highlightNote: z.string().trim().max(300).nullish(),
  recordIds: z.array(z.number().int().positive()).max(50).optional(),
  ...placeVisits,
});

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

albumsRouter.get("/", async (req, res) => {
  const albums = await prisma.album.findMany({
    where: { coupleId: req.coupleId },
    include: albumInclude,
    orderBy: { albumDate: "desc" },
  });
  res.json(await Promise.all(albums.map(serializeAlbum)));
});

albumsRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const album = await prisma.album.findFirstOrThrow({
    where: { id, coupleId: req.coupleId },
    include: albumInclude,
  });
  res.json(await serializeAlbum(album));
});

albumsRouter.post("/", async (req, res) => {
  const { recordIds = [], placeIds = [], visitAt, albumDate, ...data } = albumBody.parse(req.body);
  const { coupleId } = req;
  const album = await prisma.$transaction(async (tx) => {
    const owned = await tx.dateRecord.count({ where: { id: { in: recordIds }, coupleId } });
    if (owned !== new Set(recordIds).size) throw new HttpError(404, "Record not found");
    const { id } = await tx.album.create({
      data: {
        ...data,
        coupleId,
        albumDate: new Date(albumDate),
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
  highlightNote: z.string().trim().max(300).nullable().optional(),
  // The "best cut" shown on the album card; must be one of this album's photos.
  coverPhotoId: z.number().int().positive().nullable().optional(),
  // Replaces the visits bundled into the album; each must be free or already in this album.
  recordIds: z.array(z.number().int().positive()).max(50).optional(),
  ...placeVisits,
});

albumsRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { recordIds, placeIds = [], visitAt, albumDate, ...data } = updateBody.parse(req.body);
  const { coupleId } = req;
  await prisma.album.findFirstOrThrow({ where: { id, coupleId } });
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
    await tx.album.update({
      where: { id },
      data: {
        ...data,
        ...(albumDate && { albumDate: new Date(albumDate) }),
        ...(recordIds && { records: { set: recordIds.map((recordId) => ({ id: recordId })) } }),
      },
    });
    await addPlaceVisits(tx, { coupleId, writerId: req.userId, albumId: id }, placeIds, visitAt);
    return tx.album.findUniqueOrThrow({ where: { id }, include: albumInclude });
  });
  res.json(await serializeAlbum(album));
});

// Photo upload (CLAUDE.md "이미지 업로드 패턴"): the browser asks for presigned URLs, PUTs each image
// (and a small JPEG thumbnail of it) straight to R2, then reports the keys back here to be recorded.

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const PHOTOS_PER_REQUEST = 30;
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

const albumPhotoKey = (coupleId: number, albumId: number) =>
  new RegExp(`^couples/${coupleId}/albums/${albumId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`);

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

  // The presigned PUT can't cap size or type, so check what actually landed before recording it.
  const objects = photos.flatMap((p) => [
    { key: p.key, maxBytes: MAX_PHOTO_BYTES },
    ...(p.thumbnailKey ? [{ key: p.thumbnailKey, maxBytes: MAX_THUMBNAIL_BYTES }] : []),
  ]);
  const stats = await Promise.all(objects.map((o) => statObject(o.key)));
  const valid = stats.every((s, i) => s && s.size <= objects[i]!.maxBytes && s.contentType.startsWith("image/"));
  if (!valid) {
    await deleteObjects(objects.filter((_, i) => stats[i]).map((o) => o.key));
    throw new HttpError(400, "Upload missing or not an image under 15MB", "INVALID_UPLOAD");
  }

  const album = await prisma.$transaction(async (tx) => {
    const { _max } = await tx.photo.aggregate({ where: { albumId: id }, _max: { displayOrder: true } });
    const start = (_max.displayOrder ?? 0) + 1;
    await tx.photo.createMany({
      data: photos.map((p, i) => ({
        albumId: id,
        storageKey: p.key,
        thumbnailKey: p.thumbnailKey ?? null,
        displayOrder: start + i,
        takenAt: p.takenAt ? new Date(p.takenAt) : null,
      })),
      skipDuplicates: true, // a retried confirm shouldn't fail on keys it already recorded
    });
    return tx.album.findUniqueOrThrow({ where: { id }, include: albumInclude });
  });
  res.status(201).json(await serializeAlbum(album));
});

const photoParams = z.object({ id: z.coerce.number().int().positive(), photoId: z.coerce.number().int().positive() });

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
