import { Router } from "express";
import { z } from "zod";
import { PlaceCategory, RecordType } from "../generated/prisma/client.js";
import { HttpError } from "../middlewares/error-handler.js";
import { idParam } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const recordsRouter = Router();

const recordInclude = {
  place: { select: { id: true, name: true, address: true, googleMapsUrl: true } },
  writer: { select: { id: true, nickname: true } },
} as const;

const listQuery = z
  .object({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) })
  .refine(({ from, to }) => new Date(from) < new Date(to), { message: "`from` must be before `to`" });

const createBody = z.object({
  type: z.enum(RecordType),
  scheduledAt: z.iso.datetime({ offset: true }),
  category: z.enum(PlaceCategory),
  // Either link an existing place or name one; a named place is reused when it already exists.
  placeId: z.number().int().positive().optional(),
  placeName: z.string().trim().min(1).max(100).optional(),
  googleMapsUrl: z.url().max(500).optional(),
  // Filled in when the place was picked from Google search; without coordinates there is no map pin.
  googlePlaceId: z.string().min(1).max(200).optional(),
  address: z.string().trim().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  title: z.string().trim().min(1).max(100).optional(),
  memo: z.string().trim().max(1000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

const updateBody = z.object({
  type: z.enum(RecordType).optional(),
  scheduledAt: z.iso.datetime({ offset: true }).optional(),
  category: z.enum(PlaceCategory).optional(),
  title: z.string().trim().min(1).max(100).optional(),
  memo: z.string().trim().max(1000).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

recordsRouter.get("/", async (req, res) => {
  const { from, to } = listQuery.parse(req.query);
  const records = await prisma.dateRecord.findMany({
    where: { coupleId: req.coupleId, scheduledAt: { gte: new Date(from), lt: new Date(to) } },
    include: recordInclude,
    orderBy: { scheduledAt: "asc" },
  });
  res.json(records);
});

recordsRouter.post("/", async (req, res) => {
  const body = createBody.parse(req.body);
  const { coupleId } = req;
  if (!body.placeId && !body.placeName) {
    throw new HttpError(400, "placeId or placeName is required");
  }

  const record = await prisma.$transaction(async (tx) => {
    const visited = body.type === RecordType.RECORD;
    // Same Google place first, then same name, so repeat visits share one pin.
    let place = body.placeId
      ? await tx.place.findFirst({ where: { id: body.placeId, coupleId } })
      : ((body.googlePlaceId && (await tx.place.findFirst({ where: { coupleId, googlePlaceId: body.googlePlaceId } }))) ||
        (await tx.place.findFirst({ where: { coupleId, name: body.placeName } })));
    if (body.placeId && !place) throw new HttpError(404, "Place not found");

    const location = {
      googlePlaceId: body.googlePlaceId,
      address: body.address,
      latitude: body.latitude,
      longitude: body.longitude,
      googleMapsUrl: body.googleMapsUrl,
    };

    if (!place) {
      place = await tx.place.create({
        data: {
          coupleId,
          name: body.placeName!,
          category: body.category,
          status: visited ? "VISITED" : "WISH",
          ...location,
        },
      });
    } else {
      // A plan never downgrades a visited place; a record always upgrades a wished one.
      const promote = visited && place.status !== "VISITED";
      // A place saved by name only gets its pin once someone picks it from search.
      const locate = place.latitude === null && body.latitude !== undefined && body.longitude !== undefined;
      if (promote || locate) {
        place = await tx.place.update({
          where: { id: place.id },
          data: {
            ...(promote && { status: "VISITED" }),
            ...(locate && { ...location, googleMapsUrl: place.googleMapsUrl ?? body.googleMapsUrl }),
          },
        });
      }
    }

    return tx.dateRecord.create({
      data: {
        coupleId,
        placeId: place.id,
        type: body.type,
        title: body.title ?? place.name,
        memo: body.memo,
        category: body.category,
        rating: visited ? body.rating : undefined,
        scheduledAt: new Date(body.scheduledAt),
      },
      include: recordInclude,
    });
  });
  res.status(201).json(record);
});

recordsRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { scheduledAt, ...data } = updateBody.parse(req.body);
  const record = await prisma.$transaction(async (tx) => {
    const updated = await tx.dateRecord.update({
      where: { id, coupleId: req.coupleId },
      data: { ...data, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined },
      include: recordInclude,
    });
    if (updated.type === RecordType.RECORD && updated.placeId) {
      await tx.place.update({ where: { id: updated.placeId }, data: { status: "VISITED" } });
    }
    return updated;
  });
  res.json(record);
});

recordsRouter.delete("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  await prisma.dateRecord.delete({ where: { id, coupleId: req.coupleId } });
  res.status(204).end();
});
