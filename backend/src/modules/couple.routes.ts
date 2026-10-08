import { randomInt } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { toDateOnly } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { requireCouple } from "../middlewares/auth.js";
import { HttpError } from "../middlewares/error-handler.js";
import { loadMe } from "./auth.routes.js";

/** Mounted after requireAuth: connecting a couple needs a user, not a couple. */
export const coupleRouter = Router();

const MAX_MEMBERS = 2;
// No 0/O or 1/I/L so the code is easy to read out loud.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const generateCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

const createBody = z.object({ anniversaryDate: z.iso.date() });
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
