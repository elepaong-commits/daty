import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import { Prisma } from "../generated/prisma/client.js";
import { hashCode } from "../lib/codes.js";
import { toDateOnly } from "../lib/http.js";
import { appUrl, mailEnabled, sendMail } from "../lib/mail.js";
import { removeFromCouple } from "../lib/membership.js";
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

/** Whether the login screen should offer signing up. */
authRouter.get("/signup", (_req, res) => {
  res.json({ open: env.SIGNUP_ENABLED });
});

authRouter.post("/signup", credentialsLimiter, async (req, res) => {
  if (!env.SIGNUP_ENABLED) throw new HttpError(403, "Signup is closed", "SIGNUP_CLOSED");
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

const deleteMeBody = z.object({ password: z.string().min(1).max(72) });

/** Deletes the account: leaves the couple first (see removeFromCouple); memos and comments stay without a writer. */
authRouter.delete("/me", credentialsLimiter, requireAuth, async (req, res) => {
  const { password } = deleteMeBody.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  // 400 rather than 401: the client treats any 401 as being logged out.
  if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(400, "Password is wrong", "WRONG_PASSWORD");
  await removeFromCouple(user.id);
  await prisma.user.delete({ where: { id: user.id } });
  endSession(res);
  res.status(204).end();
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
const resetBody = z.union([
  // The 8-character code the partner issued (POST /api/couple/reset-code).
  z.object({ email, code: z.string().trim().toUpperCase().length(8), newPassword: password }),
  // The token from the emailed link (POST /api/auth/forgot-password).
  z.object({ token: z.string().min(20).max(100), newPassword: password }),
]);

/** The reset the request proves it holds, or `null`. A wrong partner code uses up one of its attempts. */
async function findReset(body: z.infer<typeof resetBody>) {
  const live = { expiresAt: { gt: new Date() }, attempts: { lt: MAX_RESET_ATTEMPTS } };
  if ("token" in body) {
    return prisma.passwordResetCode.findFirst({ where: { ...live, viaEmail: true, codeHash: hashCode(body.token) } });
  }
  const user = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
  const reset =
    user &&
    (await prisma.passwordResetCode.findFirst({
      where: { ...live, viaEmail: false, userId: user.id },
      orderBy: { createdAt: "desc" },
    }));
  if (!reset) return null;
  if (!timingSafeEqual(Buffer.from(hashCode(body.code)), Buffer.from(reset.codeHash))) {
    await prisma.passwordResetCode.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
    return null;
  }
  return reset;
}

/**
 * Forgot password: redeem a code the partner issued or the token from an emailed link, and log in.
 * Any failure gives the same answer, so it doesn't reveal which emails exist.
 */
authRouter.post("/reset-password", credentialsLimiter, async (req, res) => {
  const body = resetBody.parse(req.body);
  const invalid = new HttpError(400, "Invalid or expired reset code", "INVALID_RESET_CODE");
  const reset = await findReset(body);
  if (!reset) throw invalid;
  const data = await passwordUpdate(body.newPassword);
  try {
    // Deleting the code by id first makes a concurrent second redeem of it fail (P2025) instead of both winning.
    await prisma.$transaction([
      prisma.passwordResetCode.delete({ where: { id: reset.id } }),
      prisma.user.update({ where: { id: reset.userId }, data }),
      prisma.passwordResetCode.deleteMany({ where: { userId: reset.userId } }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") throw invalid;
    throw err;
  }
  await startSession(res, reset.userId);
  res.json(await loadMe(reset.userId));
});

// Password reset by email, for when the partner can't help (both forgot, or no partner yet).
const RESET_LINK_TTL_MS = 30 * 60 * 1000;
const RESET_MAIL_INTERVAL_MS = 2 * 60 * 1000;

// Every request counts here (they all answer 204), so one address can't be used to flood inboxes.
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 1000 : 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts", code: "RATE_LIMITED" },
});

const forgotBody = z.object({ email, lang: z.enum(["ko", "ja"]).default("ko") });

const resetMail = {
  ko: (link: string) => ({
    subject: "daty 비밀번호 재설정",
    text: `아래 링크에서 새 비밀번호를 정해 주세요. 링크는 30분 동안 한 번만 쓸 수 있어요.\n\n${link}\n\n요청한 적이 없다면 이 메일은 무시해도 됩니다.`,
  }),
  ja: (link: string) => ({
    subject: "daty パスワードの再設定",
    text: `下のリンクから新しいパスワードを設定してください。リンクは30分間、一度だけ使えます。\n\n${link}\n\n心当たりがない場合は、このメールを無視してください。`,
  }),
};

/** Always 204, whether or not the email is registered. */
authRouter.post("/forgot-password", forgotLimiter, async (req, res) => {
  const { email, lang } = forgotBody.parse(req.body);
  if (!mailEnabled) throw new HttpError(503, "Email is not configured", "MAIL_DISABLED");
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const recent =
    user &&
    (await prisma.passwordResetCode.findFirst({
      where: { userId: user.id, viaEmail: true, createdAt: { gt: new Date(Date.now() - RESET_MAIL_INTERVAL_MS) } },
      select: { id: true },
    }));
  if (user && !recent) {
    const token = randomBytes(32).toString("base64url");
    // Only the newest link works; a code from the partner stays usable beside it.
    await prisma.$transaction([
      prisma.passwordResetCode.deleteMany({ where: { userId: user.id, viaEmail: true } }),
      prisma.passwordResetCode.create({
        data: { userId: user.id, viaEmail: true, codeHash: hashCode(token), expiresAt: new Date(Date.now() + RESET_LINK_TTL_MS) },
      }),
    ]);
    const link = appUrl(`/reset-password?token=${token}`);
    // Not awaited: the answer shouldn't take longer for an address that exists.
    sendMail({ to: email, ...resetMail[lang](link) }).catch((err: unknown) => console.error("Reset mail failed:", err));
  }
  res.status(204).end();
});
