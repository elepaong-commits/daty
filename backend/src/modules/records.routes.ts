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
    let place = body.placeId
      ? await tx.place.findFirst({ where: { id: body.placeId, coupleId } })
      : await tx.place.findFirst({ where: { coupleId, name: body.placeName } });
    if (body.placeId && !place) throw new HttpError(404, "Place not found");

    if (!place) {
      place = await tx.place.create({
        data: {
          coupleId,
          name: body.placeName!,
          category: body.category,
          status: visited ? "VISITED" : "WISH",
          googleMapsUrl: body.googleMapsUrl,
        },
      });
    } else if (visited && place.status !== "VISITED") {
      // A plan never downgrades a visited place; a record always upgrades a wished one.
      place = await tx.place.update({ where: { id: place.id }, data: { status: "VISITED" } });
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
