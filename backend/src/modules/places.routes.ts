import { Router } from "express";
import { z } from "zod";
import { PlaceCategory, PlaceStatus, TipType } from "../generated/prisma/client.js";
import type { Place } from "../generated/prisma/client.js";
import { idParam, toDateOnly } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { serializePhoto } from "../lib/storage.js";

export const placesRouter = Router();

type PlaceWithVisits = Place & { records: { rating: number | null; scheduledAt: Date }[] };

/** Decimal → number, plus visit stats derived from the couple's RECORD entries. */
export function serializePlace({ records, latitude, longitude, ...place }: PlaceWithVisits) {
  const ratings = records.map((r) => r.rating).filter((r): r is number => r !== null);
  const lastVisitedAt = records.reduce<Date | null>(
    (latest, r) => (latest === null || r.scheduledAt > latest ? r.scheduledAt : latest),
    null,
  );
  return {
    ...place,
    latitude: latitude === null ? null : Number(latitude),
    longitude: longitude === null ? null : Number(longitude),
    visitCount: records.length,
    rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    lastVisitedAt,
  };
}

export const visitsInclude = {
  records: { where: { type: "RECORD" }, select: { rating: true, scheduledAt: true } },
} as const;

const listQuery = z.object({
  status: z.enum(PlaceStatus).optional(),
  category: z.enum(PlaceCategory).optional(),
});

const placeBody = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.enum(PlaceCategory),
  status: z.enum(PlaceStatus).optional(),
  address: z.string().trim().max(200).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  googleMapsUrl: z.url().max(500).nullish(),
  googlePlaceId: z.string().max(200).nullish(),
  tipType: z.enum(TipType).nullish(),
  tipText: z.string().trim().max(200).nullish(),
});

placesRouter.get("/", async (req, res) => {
  const { status, category } = listQuery.parse(req.query);
  const places = await prisma.place.findMany({
    where: { coupleId: req.coupleId, status, category },
    include: visitsInclude,
    orderBy: { updatedAt: "desc" },
  });
  res.json(places.map(serializePlace));
});

placesRouter.post("/", async (req, res) => {
  const data = placeBody.parse(req.body);
  const place = await prisma.place.create({
    data: { ...data, coupleId: req.coupleId },
    include: visitsInclude,
  });
  res.status(201).json(serializePlace(place));
});

// Detail screen: the place, its latest visit, and the albums its visits were saved in.
placesRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const place = await prisma.place.findFirstOrThrow({
    where: { id, coupleId: req.coupleId },
    include: {
      ...visitsInclude,
      records: {
        where: { type: "RECORD" },
        orderBy: { scheduledAt: "desc" },
        select: {
          id: true,
          rating: true,
          scheduledAt: true,
          album: {
            select: {
              id: true,
              title: true,
              albumDate: true,
              coverPhotoId: true,
              photos: { orderBy: { displayOrder: "asc" }, take: 3 },
              _count: { select: { photos: true } },
            },
          },
        },
      },
    },
  });
  const albums = [...new Map(place.records.flatMap((r) => (r.album ? [[r.album.id, r.album]] : []))).values()];
  const latest = place.records[0];
  res.json({
    ...serializePlace(place),
    latestVisit: latest ? { recordId: latest.id, scheduledAt: latest.scheduledAt, rating: latest.rating } : null,
    albums: await Promise.all(
      albums.map(async ({ _count, albumDate, photos, ...album }) => ({
        ...album,
        albumDate: toDateOnly(albumDate),
        photoCount: _count.photos,
        photos: await Promise.all(photos.map(serializePhoto)),
      })),
    ),
  });
});

const updateBody = placeBody.partial().extend({
  // Visit date and rating live on the latest visit record; one is created if the place has none.
  visit: z.object({ scheduledAt: z.iso.datetime({ offset: true }), rating: z.number().int().min(1).max(5).nullable() }).optional(),
});

placesRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { visit, ...data } = updateBody.parse(req.body);
  const { coupleId } = req;
  const place = await prisma.$transaction(async (tx) => {
    const updated = await tx.place.update({ where: { id, coupleId }, data });
    if (visit) {
      const latest = await tx.dateRecord.findFirst({
        where: { placeId: id, coupleId, type: "RECORD" },
        orderBy: { scheduledAt: "desc" },
      });
      const fields = { scheduledAt: new Date(visit.scheduledAt), rating: visit.rating };
      if (latest) {
        await tx.dateRecord.update({ where: { id: latest.id }, data: fields });
      } else {
        await tx.dateRecord.create({
          data: { coupleId, placeId: id, type: "RECORD", title: updated.name, category: updated.category, ...fields },
        });
      }
    }
    return tx.place.findUniqueOrThrow({ where: { id }, include: visitsInclude });
  });
  res.json(serializePlace(place));
});

placesRouter.delete("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  await prisma.place.delete({ where: { id, coupleId: req.coupleId } });
  res.status(204).end();
});
