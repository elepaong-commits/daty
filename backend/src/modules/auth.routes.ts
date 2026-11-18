import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { Prisma } from "../generated/prisma/client.js";
import { hashCode } from "../lib/codes.js";
import { accountLimiter, failureLimiter, userLimiter } from "../lib/limits.js";
import { toDateOnly } from "../lib/http.js";
import { appUrl, mailEnabled, sendMail } from "../lib/mail.js";
import { AVATAR_MAX_BYTES, avatarKeyPattern, isAvatarKey, withAvatarUrls } from "../lib/avatar.js";
import { removeFromCouple } from "../lib/membership.js";
import { deleteObjects, presignUpload, statObject } from "../lib/storage.js";
import { getDummyHash, hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { endSession, startSession } from "../lib/session.js";
import { requireAuth } from "../middlewares/auth.js";
import { HttpError } from "../middlewares/error-handler.js";

export const authRouter = Router();

// Slows down password guessing: 10 failed attempts every 15 minutes per IP, and as many per account
// (see src/lib/limits.ts for why both).
const credentialsLimiter = failureLimiter(10);
const perAccount = accountLimiter(10);
const perUser = userLimiter(10);

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
  const [me] = await withAvatarUrls([rest]);
  return {
    user: me!,
    couple: couple && { ...couple, anniversaryDate: toDateOnly(couple.anniversaryDate), users: await withAvatarUrls(couple.users) },
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

authRouter.post("/login", credentialsLimiter, perAccount, async (req, res) => {
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
authRouter.delete("/me", credentialsLimiter, requireAuth, perUser, async (req, res) => {
  const { password } = deleteMeBody.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  // 400 rather than 401: the client treats any 401 as being logged out.
  if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(400, "Password is wrong", "WRONG_PASSWORD");
  await removeFromCouple(user.id);
  await prisma.user.delete({ where: { id: user.id } });
  if (isAvatarKey(user.profileImageUrl)) await deleteObjects([user.profileImageUrl]);
  endSession(res);
  res.status(204).end();
});

// Profile photo: the browser shrinks it to a small JPEG, PUTs it straight to R2, then confirms the key.

authRouter.post("/me/avatar/upload", requireAuth, async (req, res) => {
  const key = `avatars/${req.userId}/${randomUUID()}.jpg`;
  res.json({ key, uploadUrl: await presignUpload(key), headers: { "Content-Type": "image/jpeg" } });
});

authRouter.put("/me/avatar", requireAuth, async (req, res) => {
  const { key } = z.object({ key: z.string().max(200) }).parse(req.body);
  if (!avatarKeyPattern(req.userId).test(key)) throw new HttpError(400, "Unknown avatar key", "INVALID_UPLOAD");
  const stat = await statObject(key);
  if (!stat || stat.size > AVATAR_MAX_BYTES || !stat.contentType.startsWith("image/")) {
    if (stat) await deleteObjects([key]);
    throw new HttpError(400, "Upload missing, of the wrong type or too large", "INVALID_UPLOAD");
  }
  await replaceAvatar(req.userId, key);
  res.json(await loadMe(req.userId));
});

authRouter.delete("/me/avatar", requireAuth, async (req, res) => {
  await replaceAvatar(req.userId, null);
  res.json(await loadMe(req.userId));
});

/** Sets the avatar and deletes the photo it replaces. */
async function replaceAvatar(userId: number, key: string | null) {
  const { profileImageUrl: previous } = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { profileImageUrl: true } });
  await prisma.user.update({ where: { id: userId }, data: { profileImageUrl: key } });
  if (isAvatarKey(previous) && previous !== key) await deleteObjects([previous]);
}

/** New hash plus the change time, which logs out every session issued before it (see requireAuth). */
const passwordUpdate = async (newPassword: string) => ({
  passwordHash: await hashPassword(newPassword),
  passwordChangedAt: new Date(),
});

const changePasswordBody = z.object({ currentPassword: z.string().min(1).max(72), newPassword: password });

/** Change password while logged in. This device gets a fresh session; other devices are logged out. */
authRouter.post("/password", credentialsLimiter, requireAuth, perUser, async (req, res) => {
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
authRouter.post("/reset-password", credentialsLimiter, perAccount, async (req, res) => {
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
const forgotLimiter = failureLimiter(5, { all: true });

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

/** Makes a fresh link for a registered email and mails it, unless one went out a moment ago. */
async function issueResetLink(email: string, lang: keyof typeof resetMail) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;
  const recent = await prisma.passwordResetCode.findFirst({
    where: { userId: user.id, viaEmail: true, createdAt: { gt: new Date(Date.now() - RESET_MAIL_INTERVAL_MS) } },
    select: { id: true },
  });
  if (recent) return;
  const token = randomBytes(32).toString("base64url");
  // Only the newest link works; a code from the partner stays usable beside it.
  await prisma.$transaction([
    prisma.passwordResetCode.deleteMany({ where: { userId: user.id, viaEmail: true } }),
    prisma.passwordResetCode.create({
      data: { userId: user.id, viaEmail: true, codeHash: hashCode(token), expiresAt: new Date(Date.now() + RESET_LINK_TTL_MS) },
    }),
  ]);
  await sendMail({ to: email, ...resetMail[lang](appUrl(`/reset-password?token=${token}`)) });
}

// Links are made one at a time, so two quick requests for the same address can't both pass the
// "one went out a moment ago" check and send two mails.
let resetQueue: Promise<void> = Promise.resolve();

/** Resolves once every link asked for so far has been made and sent. For tests. */
export const resetMailsSettled = () => resetQueue;

/**
 * Always 204, whether or not the email is registered. It answers before looking the email up, so how
 * long it takes doesn't tell either.
 */
authRouter.post("/forgot-password", forgotLimiter, async (req, res) => {
  const { email, lang } = forgotBody.parse(req.body);
  if (!mailEnabled) throw new HttpError(503, "Email is not configured", "MAIL_DISABLED");
  res.status(204).end();
  resetQueue = resetQueue.then(() =>
    issueResetLink(email, lang).catch((err: unknown) => console.error("Reset link failed:", err)),
  );
});
