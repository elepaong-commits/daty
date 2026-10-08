import { Router } from "express";
import { z } from "zod";
import { PlaceCategory, PlaceStatus, TipType } from "../generated/prisma/client.js";
import type { Place } from "../generated/prisma/client.js";
import { idParam } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

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

placesRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = placeBody.partial().parse(req.body);
  const place = await prisma.place.update({
    where: { id, coupleId: req.coupleId },
    data,
    include: visitsInclude,
  });
  res.json(serializePlace(place));
});

placesRouter.delete("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  await prisma.place.delete({ where: { id, coupleId: req.coupleId } });
  res.status(204).end();
});
