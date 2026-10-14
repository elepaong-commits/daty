import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import { Prisma } from "../generated/prisma/client.js";
import { hashCode } from "../lib/codes.js";
import { toDateOnly } from "../lib/http.js";
import { getDummyHash, hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { endSession, startSession } from "../lib/session.js";
import { requireAuth } from "../middlewares/auth.js";
import { HttpError } from "../middlewares/error-handler.js";

export const authRouter = Router();

// Slows down password guessing: 10 failed attempts per IP every 15 minutes (tests fail on purpose more often).
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many attempts", code: "RATE_LIMITED" },
});

const email = z.email().max(254).transform((v) => v.trim().toLowerCase());
const password = z.string().min(8, "8자 이상").max(72);

const nickname = z.string().trim().min(1).max(20);
const signupBody = z.object({ email, password, nickname });
const updateMeBody = z.object({ nickname });
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

authRouter.patch("/me", requireAuth, async (req, res) => {
  const { nickname } = updateMeBody.parse(req.body);
  await prisma.user.update({ where: { id: req.userId }, data: { nickname } });
  res.json(await loadMe(req.userId));
});

/** New hash plus the change time, which logs out every session issued before it (see requireAuth). */
const passwordUpdate = async (newPassword: string) => ({
  passwordHash: await hashPassword(newPassword),
  passwordChangedAt: new Date(),
});

const changePasswordBody = z.object({ currentPassword: z.string().min(1).max(72), newPassword: password });

/** Change password while logged in. This device gets a fresh session; other devices are logged out. */
authRouter.post("/password", credentialsLimiter, requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordBody.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  // 400 rather than 401: the client treats any 401 as being logged out.
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new HttpError(400, "Current password is wrong", "WRONG_PASSWORD");
  }
  await prisma.user.update({ where: { id: user.id }, data: await passwordUpdate(newPassword) });
  await startSession(res, user.id);
  res.status(204).end();
});

const MAX_RESET_ATTEMPTS = 5;
const resetBody = z.object({ email, code: z.string().trim().toUpperCase().length(8), newPassword: password });

/**
 * Forgot password: redeem a code the partner issued (POST /api/couple/reset-code) and log in.
 * Any failure gives the same answer, so it doesn't reveal which emails exist.
 */
authRouter.post("/reset-password", credentialsLimiter, async (req, res) => {
  const { email, code, newPassword } = resetBody.parse(req.body);
  const invalid = new HttpError(400, "Invalid or expired reset code", "INVALID_RESET_CODE");
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const reset =
    user &&
    (await prisma.passwordResetCode.findFirst({
      where: { userId: user.id, expiresAt: { gt: new Date() }, attempts: { lt: MAX_RESET_ATTEMPTS } },
      orderBy: { createdAt: "desc" },
    }));
  if (!user || !reset) throw invalid;
  if (!timingSafeEqual(Buffer.from(hashCode(code)), Buffer.from(reset.codeHash))) {
    await prisma.passwordResetCode.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
    throw invalid;
  }
  const data = await passwordUpdate(newPassword);
  try {
    // Deleting the code by id first makes a concurrent second redeem of it fail (P2025) instead of both winning.
    await prisma.$transaction([
      prisma.passwordResetCode.delete({ where: { id: reset.id } }),
      prisma.user.update({ where: { id: user.id }, data }),
      prisma.passwordResetCode.deleteMany({ where: { userId: user.id } }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") throw invalid;
    throw err;
  }
  await startSession(res, user.id);
  res.json(await loadMe(user.id));
});
