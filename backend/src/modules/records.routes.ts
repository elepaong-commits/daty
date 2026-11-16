import { Router } from "express";
import { z } from "zod";
import { PlaceCategory, Prisma, RecordType } from "../generated/prisma/client.js";
import { HttpError } from "../middlewares/error-handler.js";
import { idParam, webUrl } from "../lib/http.js";
import { nicknameOf } from "../lib/feedback.js";
import { prisma } from "../lib/prisma.js";
import { notifyPartner } from "../lib/push.js";

export const recordsRouter = Router();

const recordInclude = {
  place: { select: { id: true, name: true, address: true, googleMapsUrl: true } },
  writer: { select: { id: true, nickname: true } },
} as const;

const listQuery = z
  .object({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) })
  .refine(({ from, to }) => new Date(from) < new Date(to), { message: "`from` must be before `to`" });

// Where a record happened. Either an existing place id, or a name that is matched or created;
// Google search adds coordinates (no coordinates means no map pin).
const placeFields = {
  placeId: z.number().int().positive().optional(),
  placeName: z.string().trim().min(1).max(100).optional(),
  googleMapsUrl: webUrl().optional(),
  googlePlaceId: z.string().min(1).max(200).optional(),
  address: z.string().trim().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
};

// `memo` is about this date; `placeNote` is added to the place's own memos (shown on the place screen).
const placeNote = z.string().trim().min(1).max(500).optional();

const createBody = z.object({
  type: z.enum(RecordType),
  scheduledAt: z.iso.datetime({ offset: true }),
  // When this stop ends (optional); together the day's records make the date's course.
  endsAt: z.iso.datetime({ offset: true }).optional(),
  category: z.enum(PlaceCategory),
  ...placeFields,
  title: z.string().trim().min(1).max(100).optional(),
  memo: z.string().trim().max(1000).optional(),
  placeNote,
  rating: z.number().int().min(1).max(5).optional(),
});

const updateBody = z.object({
  type: z.enum(RecordType).optional(),
  scheduledAt: z.iso.datetime({ offset: true }).optional(),
  endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
  category: z.enum(PlaceCategory).optional(),
  ...placeFields,
  memo: z.string().trim().max(1000).nullable().optional(),
  placeNote,
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

/** A stop ends after it starts. */
function assertEndsAfter(scheduledAt: Date, endsAt: Date | null | undefined) {
  if (endsAt && endsAt <= scheduledAt) throw new HttpError(400, "endsAt must be after scheduledAt", "ENDS_BEFORE_START");
}

type PlaceInput = z.infer<z.ZodObject<typeof placeFields>> & { category: PlaceCategory };

/** Finds (Google place id, then name) or creates the couple's place, filling in what it was missing. */
async function resolvePlace(tx: Prisma.TransactionClient, coupleId: number, input: PlaceInput, visited: boolean) {
  let place = input.placeId
    ? await tx.place.findFirst({ where: { id: input.placeId, coupleId } })
    : ((input.googlePlaceId && (await tx.place.findFirst({ where: { coupleId, googlePlaceId: input.googlePlaceId } }))) ||
      // Guard the name lookup: Prisma reads `name: undefined` as "any name".
      // A place picked from search only matches by name one that has no Google place yet: the same
      // name with another Google place is a different branch, which gets its own pin.
      (input.placeName !== undefined &&
        (await tx.place.findFirst({
          where: { coupleId, name: input.placeName, ...(input.googlePlaceId && { googlePlaceId: null }) },
        }))) ||
      null);
  if (input.placeId && !place) throw new HttpError(404, "Place not found");
  if (!place && input.placeName === undefined) throw new HttpError(400, "placeName is required for a new place");

  const location = {
    googlePlaceId: input.googlePlaceId,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    googleMapsUrl: input.googleMapsUrl,
  };

  if (!place) {
    return tx.place.create({
      data: {
        coupleId,
        name: input.placeName!,
        category: input.category,
        status: visited ? "VISITED" : "WISH",
        ...location,
      },
    });
  }
  // A plan never downgrades a visited place; a record always upgrades a wished one.
  const promote = visited && place.status !== "VISITED";
  // A place saved by name only gets its pin once someone picks it from search.
  const locate = place.latitude === null && input.latitude !== undefined && input.longitude !== undefined;
  if (!promote && !locate) return place;
  return tx.place.update({
    where: { id: place.id },
    data: {
      ...(promote && { status: "VISITED" }),
      ...(locate && { ...location, googleMapsUrl: place.googleMapsUrl ?? input.googleMapsUrl }),
    },
  });
}

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
  const endsAt = body.endsAt ? new Date(body.endsAt) : undefined;
  assertEndsAfter(new Date(body.scheduledAt), endsAt);

  const record = await prisma.$transaction(async (tx) => {
    const visited = body.type === RecordType.RECORD;
    const place = await resolvePlace(tx, coupleId, body, visited);
    if (body.placeNote) {
      await tx.placeNote.create({ data: { coupleId, placeId: place.id, writerId: req.userId, content: body.placeNote } });
    }

    return tx.dateRecord.create({
      data: {
        coupleId,
        writerId: req.userId,
        placeId: place.id,
        type: body.type,
        title: body.title ?? place.name,
        memo: body.memo,
        category: body.category,
        rating: visited ? body.rating : undefined,
        scheduledAt: new Date(body.scheduledAt),
        endsAt,
      },
      include: recordInclude,
    });
  });
  const nickname = await nicknameOf(req.userId);
  const planned = record.type === RecordType.PLAN;
  notifyPartner(coupleId, req.userId, (locale) => ({
    title:
      locale === "ja"
        ? `${nickname}さんが${planned ? "新しい予定を入れました" : "デートの記録を残しました"}`
        : `${nickname}님이 ${planned ? "새 일정을 잡았어요" : "데이트 기록을 남겼어요"}`,
    body: record.place?.name ?? record.title,
    url: "/calendar",
    tag: `record-${record.id}`,
  }));
  res.status(201).json(record);
});

recordsRouter.patch("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const body = updateBody.parse(req.body);
  const { coupleId } = req;

  const record = await prisma.$transaction(async (tx) => {
    const current = await tx.dateRecord.findFirst({ where: { id, coupleId }, include: { place: true } });
    if (!current) throw new HttpError(404, "Not Found");
    const type = body.type ?? current.type;
    assertEndsAfter(
      body.scheduledAt ? new Date(body.scheduledAt) : current.scheduledAt,
      body.endsAt === undefined ? current.endsAt : body.endsAt === null ? null : new Date(body.endsAt),
    );
    const category = body.category ?? current.category;
    const visited = type === RecordType.RECORD;

    // Moving the record to another place: picked from search, or a different name typed in.
    const relink =
      body.placeId !== undefined ||
      body.googlePlaceId !== undefined ||
      (body.placeName !== undefined && body.placeName !== current.place?.name);
    let placeId = current.placeId;
    let title: string | undefined;
    if (relink) {
      ({ id: placeId, name: title } = await resolvePlace(tx, coupleId, { ...body, category }, visited));
    } else if (current.placeId) {
      // Same place: a new map link belongs to it, and a visit promotes it.
      const promote = visited && current.place?.status !== "VISITED";
      if (body.googleMapsUrl !== undefined || promote) {
        await tx.place.update({
          where: { id: current.placeId },
          data: { googleMapsUrl: body.googleMapsUrl, ...(promote && { status: "VISITED" }) },
        });
      }
    }
    if (body.placeNote) {
      if (!placeId) throw new HttpError(400, "placeNote needs a place");
      await tx.placeNote.create({ data: { coupleId, placeId, writerId: req.userId, content: body.placeNote } });
    }

    return tx.dateRecord.update({
      where: { id },
      data: {
        type,
        category,
        placeId,
        title,
        memo: body.memo,
        // Plans have no rating; a visit keeps its rating unless one is sent.
        rating: visited ? body.rating : null,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        endsAt: body.endsAt === undefined ? undefined : body.endsAt === null ? null : new Date(body.endsAt),
      },
      include: recordInclude,
    });
  });
  res.json(record);
});

recordsRouter.delete("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  await prisma.dateRecord.delete({ where: { id, coupleId: req.coupleId } });
  res.status(204).end();
});
