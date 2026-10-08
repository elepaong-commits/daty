import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { toDateOnly } from "../lib/http.js";
import { getDummyHash, hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { endSession, startSession } from "../lib/session.js";
import { requireAuth } from "../middlewares/auth.js";
import { HttpError } from "../middlewares/error-handler.js";

export const authRouter = Router();

// Slows down password guessing: 10 attempts per IP every 15 minutes.
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many attempts", code: "RATE_LIMITED" },
});

const email = z.email().max(254).transform((v) => v.trim().toLowerCase());
const password = z.string().min(8, "8자 이상").max(72);

const signupBody = z.object({ email, password, nickname: z.string().trim().min(1).max(20) });
const loginBody = z.object({ email, password: z.string().min(1).max(72) });

/** Shape returned by every auth endpoint: who is logged in and their couple, if any. */
export async function loadMe(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nickname: true,
      profileImageUrl: true,
      couple: {
        select: {
          id: true,
          coupleCode: true,
          anniversaryDate: true,
          users: { select: { id: true, nickname: true, profileImageUrl: true } },
        },
      },
    },
  });
  if (!user) throw new HttpError(401, "Unauthorized", "UNAUTHENTICATED");
  const { couple, ...rest } = user;
  return {
    user: rest,
    couple: couple && { ...couple, anniversaryDate: toDateOnly(couple.anniversaryDate) },
  };
}

authRouter.post("/signup", credentialsLimiter, async (req, res) => {
  const body = signupBody.parse(req.body);
  try {
    const user = await prisma.user.create({
      data: { email: body.email, nickname: body.nickname, passwordHash: await hashPassword(body.password) },
    });
    await startSession(res, user.id);
    res.status(201).json(await loadMe(user.id));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "Email already registered", "EMAIL_TAKEN");
    }
    throw err;
  }
});

authRouter.post("/login", credentialsLimiter, async (req, res) => {
  const body = loginBody.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  // Same work and same error whether or not the email exists.
  const valid = await verifyPassword(body.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  await startSession(res, user.id);
  res.json(await loadMe(user.id));
});

authRouter.post("/logout", (_req, res) => {
  endSession(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(await loadMe(req.userId));
});
