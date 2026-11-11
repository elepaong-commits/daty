import { Router } from "express";
import { z } from "zod";
import { PlaceCategory, PlaceStatus, Prisma } from "../generated/prisma/client.js";
import type { Place } from "../generated/prisma/client.js";
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
import { notifyPartner } from "../lib/push.js";
import { HttpError } from "../middlewares/error-handler.js";
import { prisma } from "../lib/prisma.js";
import { serializePhoto } from "../lib/storage.js";

export const placesRouter = Router();

type PlaceWithVisits = Place & {
  records: { rating: number | null; scheduledAt: Date }[];
  notes: { content: string }[];
};

/** Decimal → number, plus visit stats derived from the couple's RECORD entries and the newest memo. */
export function serializePlace({ records, notes, latitude, longitude, ...place }: PlaceWithVisits) {
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
    latestNote: notes[0]?.content ?? null,
  };
}

export const visitsInclude = {
  records: { where: { type: "RECORD" }, select: { rating: true, scheduledAt: true } },
  notes: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } },
} as const;

const noteSelect = {
  id: true,
  content: true,
  createdAt: true,
  writer: { select: { id: true, nickname: true } },
  ...feedbackInclude,
} as const;

// Tags are stored inline as `{{EAT}}`-style tokens so each viewer sees them in their own language.
const noteContent = z.string().trim().min(1).max(500);

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

const createBody = placeBody.extend({ note: noteContent.optional() });

placesRouter.post("/", async (req, res) => {
  const { note, ...data } = createBody.parse(req.body);
  const { coupleId, userId } = req;
  try {
    const place = await prisma.place.create({
      data: {
        ...data,
        coupleId,
        ...(note && { notes: { create: { coupleId, writerId: userId, content: note } } }),
      },
      include: visitsInclude,
    });
    res.status(201).json(serializePlace(place));
  } catch (err) {
    // The same Google place is already on the couple's map.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "Place already exists", "PLACE_EXISTS");
    }
    throw err;
  }
});

// Detail screen: the place, its visits (newest first), its memos, and the albums its visits were saved in.
placesRouter.get("/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const place = await prisma.place.findFirstOrThrow({
    where: { id, coupleId: req.coupleId },
    include: {
      ...visitsInclude,
      notes: { orderBy: { createdAt: "desc" }, select: noteSelect },
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
              albumEndDate: true,
              monthly: true,
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
  // A picked best cut may sit beyond the first three photos; with none picked the first photo stands in.
  const coverIds = albums.flatMap((a) => (a.coverPhotoId && !a.photos.some((p) => p.id === a.coverPhotoId) ? [a.coverPhotoId] : []));
  const covers = coverIds.length > 0 ? await prisma.photo.findMany({ where: { id: { in: coverIds } } }) : [];
  const latest = place.records[0];
  res.json({
    ...serializePlace(place),
    notes: place.notes,
    latestVisit: latest ? { recordId: latest.id, scheduledAt: latest.scheduledAt, rating: latest.rating } : null,
    visits: place.records.map((r) => ({ recordId: r.id, scheduledAt: r.scheduledAt, rating: r.rating })),
    albums: await Promise.all(
      albums.map(async ({ _count, albumDate, albumEndDate, photos, ...album }) => {
        const cover = [...photos, ...covers].find((p) => p.id === album.coverPhotoId) ?? photos[0];
        return {
          ...album,
          albumDate: toDateOnly(albumDate),
          albumEndDate: toDateOnly(albumEndDate ?? albumDate),
          photoCount: _count.photos,
          coverPhoto: cover ? await serializePhoto(cover) : null,
          photos: await Promise.all(photos.map(serializePhoto)),
        };
      }),
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

placesRouter.post("/:id/notes", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { content } = z.object({ content: noteContent }).parse(req.body);
  const { coupleId, userId } = req;
  await prisma.place.findFirstOrThrow({ where: { id, coupleId }, select: { id: true } });
  const note = await prisma.placeNote.create({
    data: { coupleId, placeId: id, writerId: userId, content },
    select: noteSelect,
  });
  res.status(201).json(note);
});

placesRouter.delete("/:id/notes/:noteId", async (req, res) => {
  const { id, noteId } = idParam.extend({ noteId: z.coerce.number().int().positive() }).parse(req.params);
  await prisma.placeNote.delete({ where: { id: noteId, placeId: id, coupleId: req.coupleId } });
  res.status(204).end();
});

// Reactions and comments on a place memo. Every call answers with the memo's feedback as it now stands.

const noteParams = idParam.extend({ noteId: z.coerce.number().int().positive() });

async function noteTarget(req: { params: unknown; coupleId: number }) {
  const { id, noteId } = noteParams.parse(req.params);
  await prisma.placeNote.findFirstOrThrow({ where: { id: noteId, placeId: id, coupleId: req.coupleId }, select: { id: true } });
  return { placeId: id, target: { noteId } };
}

placesRouter.put("/:id/notes/:noteId/reaction", async (req, res) => {
  const { placeId, target } = await noteTarget(req);
  const { emoji } = reactionBody.parse(req.body);
  await setReaction(req.coupleId, req.userId, target, emoji);
  const nickname = await nicknameOf(req.userId);
  notifyPartner(req.coupleId, req.userId, (locale) => ({
    title: locale === "ja" ? `${nickname}さんがメモに${emoji}` : `${nickname}님이 메모에 ${emoji}`,
    body: "",
    url: `/places/${placeId}`,
    tag: `note-reaction-${target.noteId}`,
  }));
  res.json(await loadFeedback(target));
});

placesRouter.delete("/:id/notes/:noteId/reaction", async (req, res) => {
  const { target } = await noteTarget(req);
  await clearReaction(req.userId, target);
  res.json(await loadFeedback(target));
});

placesRouter.post("/:id/notes/:noteId/comments", async (req, res) => {
  const { placeId, target } = await noteTarget(req);
  const { content } = commentBody.parse(req.body);
  await addComment(req.coupleId, req.userId, target, content);
  const nickname = await nicknameOf(req.userId);
  notifyPartner(req.coupleId, req.userId, (locale) => ({
    title: locale === "ja" ? `${nickname}さんがメモにコメント` : `${nickname}님이 메모에 댓글을 남겼어요`,
    body: content,
    url: `/places/${placeId}`,
  }));
  res.status(201).json(await loadFeedback(target));
});

placesRouter.delete("/:id/notes/:noteId/comments/:commentId", async (req, res) => {
  const { target } = await noteTarget(req);
  const { commentId } = z.object({ commentId: z.coerce.number().int().positive() }).parse(req.params);
  await deleteComment(req.userId, target, commentId);
  res.json(await loadFeedback(target));
});
