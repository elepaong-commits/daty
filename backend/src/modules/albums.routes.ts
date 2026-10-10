import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../middlewares/error-handler.js";
import { idParam, toDateOnly } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const albumsRouter = Router();

const albumInclude = {
  photos: { orderBy: { displayOrder: "asc" } },
  records: {
    select: { id: true, category: true, place: { select: { id: true, name: true, address: true } } },
    orderBy: { scheduledAt: "asc" },
  },
} as const satisfies Prisma.AlbumInclude;

type AlbumWithRelations = Prisma.AlbumGetPayload<{ include: typeof albumInclude }>;

function serializeAlbum({ photos, records, ...album }: AlbumWithRelations) {
  const cover = photos.find((p) => p.id === album.coverPhotoId) ?? photos[0] ?? null;
  const places = [...new Map(records.flatMap((r) => (r.place ? [[r.place.id, r.place]] : []))).values()];
  return {
    ...album,
    albumDate: toDateOnly(album.albumDate),
    photoCount: photos.length,
    coverPhoto: cover,
    category: records[0]?.category ?? null,
    places,
    photos,
  };
}

const albumBody = z.object({
  title: z.string().trim().min(1).max(100),
  albumDate: z.iso.date(),
  highlightNote: z.string().trim().max(300).nullish(),
  recordIds: z.array(z.number().int().positive()).max(50).optional(),
});

albumsRouter.get("/", async (req, res) => {
  const albums = await prisma.album.findMany({
    where: { coupleId: req.coupleId },
    include: albumInclude,
    orderBy: { albumDate: "desc" },
  });
  res.json(albums.map(serializeAlbum));
});

albumsRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const album = await prisma.album.findFirstOrThrow({
    where: { id, coupleId: req.coupleId },
    include: albumInclude,
  });
  res.json(serializeAlbum(album));
});

albumsRouter.post("/", async (req, res) => {
  const { recordIds = [], albumDate, ...data } = albumBody.parse(req.body);
  const { coupleId } = req;
  const album = await prisma.$transaction(async (tx) => {
    const owned = await tx.dateRecord.count({ where: { id: { in: recordIds }, coupleId } });
    if (owned !== new Set(recordIds).size) throw new HttpError(404, "Record not found");
    return tx.album.create({
      data: {
        ...data,
        coupleId,
        albumDate: new Date(albumDate),
        records: { connect: recordIds.map((id) => ({ id })) },
      },
      include: albumInclude,
    });
  });
  res.status(201).json(serializeAlbum(album));
});

const updateBody = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  highlightNote: z.string().trim().max(300).nullable().optional(),
  // The "best cut" shown on the album card; must be one of this album's photos.
  coverPhotoId: z.number().int().positive().nullable().optional(),
});

albumsRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = updateBody.parse(req.body);
  await prisma.album.findFirstOrThrow({ where: { id, coupleId: req.coupleId } });
  if (data.coverPhotoId) {
    await prisma.photo.findFirstOrThrow({ where: { id: data.coverPhotoId, albumId: id } });
  }
  const album = await prisma.album.update({ where: { id }, data, include: albumInclude });
  res.json(serializeAlbum(album));
});

const photoParams = z.object({ id: z.coerce.number().int().positive(), photoId: z.coerce.number().int().positive() });

albumsRouter.delete("/:id/photos/:photoId", async (req, res) => {
  const { id, photoId } = photoParams.parse(req.params);
  await prisma.$transaction(async (tx) => {
    const album = await tx.album.findFirstOrThrow({ where: { id, coupleId: req.coupleId } });
    await tx.photo.delete({ where: { id: photoId, albumId: id } });
    if (album.coverPhotoId === photoId) await tx.album.update({ where: { id }, data: { coverPhotoId: null } });
  });
  // TODO(r2): also delete the stored image once uploads land in R2.
  res.status(204).end();
});

albumsRouter.delete("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  await prisma.album.delete({ where: { id, coupleId: req.coupleId } });
  res.status(204).end();
});
