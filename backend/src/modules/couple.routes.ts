import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { hashCode, randomCode } from "../lib/codes.js";
import { toDateOnly } from "../lib/http.js";
import { feedbackInclude } from "../lib/feedback.js";
import { prisma } from "../lib/prisma.js";
import { statObject, storageEnabled } from "../lib/storage.js";
import { requireCouple } from "../middlewares/auth.js";
import { HttpError } from "../middlewares/error-handler.js";
import { loadMe } from "./auth.routes.js";

/** Mounted after requireAuth: connecting a couple needs a user, not a couple. */
export const coupleRouter = Router();

const MAX_MEMBERS = 2;
const generateCode = () => randomCode(6);

const createBody = z.object({ anniversaryDate: z.iso.date() });
const updateBody = createBody;
const joinBody = z.object({ code: z.string().trim().toUpperCase().length(6) });

async function assertNotInCouple(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { coupleId: true } });
  if (user.coupleId !== null) throw new HttpError(409, "Already in a couple", "ALREADY_IN_COUPLE");
}

coupleRouter.get("/", requireCouple, async (req, res) => {
  const couple = await prisma.couple.findUniqueOrThrow({
    where: { id: req.coupleId },
    include: { users: { select: { id: true, nickname: true, profileImageUrl: true } } },
  });
  res.json({
    id: couple.id,
    coupleCode: couple.coupleCode,
    anniversaryDate: toDateOnly(couple.anniversaryDate),
    users: couple.users,
  });
});

coupleRouter.patch("/", requireCouple, async (req, res) => {
  const { anniversaryDate } = updateBody.parse(req.body);
  await prisma.couple.update({ where: { id: req.coupleId }, data: { anniversaryDate: new Date(anniversaryDate) } });
  res.json(await loadMe(req.userId));
});

coupleRouter.post("/", async (req, res) => {
  const { anniversaryDate } = createBody.parse(req.body);
  await assertNotInCouple(req.userId);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.couple.create({
        data: {
          coupleCode: generateCode(),
          anniversaryDate: new Date(anniversaryDate),
          users: { connect: { id: req.userId } },
        },
      });
      res.status(201).json(await loadMe(req.userId));
      return;
    } catch (err) {
      // Retry on the rare code collision.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    }
  }
  throw new HttpError(503, "Could not generate a couple code");
});

coupleRouter.post("/join", async (req, res) => {
  const { code } = joinBody.parse(req.body);
  await prisma.$transaction(
    async (tx) => {
      const me = await tx.user.findUniqueOrThrow({ where: { id: req.userId }, select: { coupleId: true } });
      if (me.coupleId !== null) throw new HttpError(409, "Already in a couple", "ALREADY_IN_COUPLE");
      const couple = await tx.couple.findUnique({
        where: { coupleCode: code },
        include: { _count: { select: { users: true } } },
      });
      if (!couple) throw new HttpError(404, "Invalid couple code", "INVALID_CODE");
      if (couple._count.users >= MAX_MEMBERS) throw new HttpError(409, "Couple is full", "COUPLE_FULL");
      await tx.user.update({ where: { id: req.userId }, data: { coupleId: couple.id } });
    },
    // Two people joining with the same code at once must not both get in.
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  res.json(await loadMe(req.userId));
});

// Password reset without email: the partner, logged in on their phone, issues a one-time code for the
// one who forgot and passes it on; it is redeemed at POST /api/auth/reset-password.
const RESET_CODE_TTL_MS = 10 * 60 * 1000;

coupleRouter.post("/reset-code", requireCouple, async (req, res) => {
  const partner = await prisma.user.findFirst({
    where: { coupleId: req.coupleId, id: { not: req.userId } },
    select: { id: true, nickname: true },
  });
  if (!partner) throw new HttpError(409, "No partner to reset", "NO_PARTNER");
  const code = randomCode(8);
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS);
  // Only the newest code works.
  await prisma.$transaction([
    prisma.passwordResetCode.deleteMany({ where: { userId: partner.id, viaEmail: false } }),
    prisma.passwordResetCode.create({ data: { userId: partner.id, issuedById: req.userId, codeHash: hashCode(code), expiresAt } }),
  ]);
  res.status(201).json({ code, expiresAt, user: { nickname: partner.nickname } });
});

// How much of the R2 bucket the couple's photos and videos take up. R2's free plan holds 10 GB.
const FREE_STORAGE_BYTES = 10 * 1000 ** 3;
const SIZE_BACKFILL_PER_REQUEST = 60;

/** Photos uploaded before sizes were recorded get theirs from R2, a batch per request. */
async function backfillSizes(coupleId: number) {
  if (!storageEnabled) return;
  const unsized = await prisma.photo.findMany({
    where: { album: { coupleId }, sizeBytes: null, storageKey: { not: null } },
    select: { id: true, storageKey: true, thumbnailKey: true },
    take: SIZE_BACKFILL_PER_REQUEST,
  });
  await Promise.all(
    unsized.map(async (photo) => {
      try {
        const [original, thumbnail] = await Promise.all([
          statObject(photo.storageKey!),
          photo.thumbnailKey ? statObject(photo.thumbnailKey) : null,
        ]);
        await prisma.photo.update({ where: { id: photo.id }, data: { sizeBytes: (original?.size ?? 0) + (thumbnail?.size ?? 0) } });
      } catch (err) {
        console.error(`Sizing photo ${photo.id} failed:`, err);
      }
    }),
  );
}

coupleRouter.get("/storage", requireCouple, async (req, res) => {
  const { coupleId } = req;
  await backfillSizes(coupleId);
  const [groups, pending] = await Promise.all([
    prisma.photo.groupBy({ by: ["mediaType"], where: { album: { coupleId } }, _sum: { sizeBytes: true }, _count: true }),
    prisma.photo.count({ where: { album: { coupleId }, sizeBytes: null, storageKey: { not: null } } }),
  ]);
  const of = (mediaType: "PHOTO" | "VIDEO") => {
    const group = groups.find((g) => g.mediaType === mediaType);
    return { count: group?._count ?? 0, bytes: Number(group?._sum.sizeBytes ?? 0) };
  };
  const [photos, videos] = [of("PHOTO"), of("VIDEO")];
  res.json({
    usedBytes: photos.bytes + videos.bytes,
    freeBytes: FREE_STORAGE_BYTES,
    photos,
    videos,
    // Files whose size isn't known yet; asking again sizes the next batch.
    pending,
  });
});

// Everything the couple wrote, as one JSON file to keep. Photos and videos are listed with their
// storage keys; the files themselves are saved from each album.
coupleRouter.get("/export", requireCouple, async (req, res) => {
  const { coupleId } = req;
  const [couple, places, records, albums] = await Promise.all([
    prisma.couple.findUniqueOrThrow({
      where: { id: coupleId },
      select: { anniversaryDate: true, createdAt: true, users: { select: { id: true, nickname: true, email: true } } },
    }),
    prisma.place.findMany({
      where: { coupleId },
      orderBy: { id: "asc" },
      include: { notes: { orderBy: { createdAt: "asc" }, select: { id: true, content: true, createdAt: true, writerId: true, ...feedbackInclude } } },
    }),
    prisma.dateRecord.findMany({ where: { coupleId }, orderBy: { scheduledAt: "asc" } }),
    prisma.album.findMany({
      where: { coupleId },
      orderBy: { albumDate: "asc" },
      include: { photos: { orderBy: { displayOrder: "asc" }, include: feedbackInclude } },
    }),
  ]);
  const body = {
    exportedAt: new Date(),
    couple: { ...couple, anniversaryDate: toDateOnly(couple.anniversaryDate) },
    places: places.map(({ latitude, longitude, ...place }) => ({
      ...place,
      latitude: latitude === null ? null : Number(latitude),
      longitude: longitude === null ? null : Number(longitude),
    })),
    records,
    albums: albums.map(({ albumDate, albumEndDate, photos, ...album }) => ({
      ...album,
      albumDate: toDateOnly(albumDate),
      albumEndDate: toDateOnly(albumEndDate ?? albumDate),
      photos: photos.map(({ sizeBytes, ...photo }) => ({ ...photo, sizeBytes: sizeBytes === null ? null : Number(sizeBytes) })),
    })),
  };
  res.setHeader("Content-Disposition", `attachment; filename="daty-${toDateOnly(new Date())}.json"`);
  res.json(body);
});
