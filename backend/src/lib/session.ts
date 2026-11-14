import type { CookieOptions, Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.js";

export const SESSION_COOKIE = "daty_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const secret = new TextEncoder().encode(env.SESSION_SECRET);

const cookieOptions: CookieOptions = {
  httpOnly: true,
  // Lax blocks the cookie on cross-site POSTs, which is our CSRF protection.
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/",
};

export async function startSession(res: Response, userId: number) {
  const token = await new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: MAX_AGE_SECONDS * 1000 });
}

// Sessions slide: one older than this is reissued for another full 30 days on the next request,
// so using the app at least once a month keeps you logged in. Once a day keeps Set-Cookie off most responses.
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export const sessionNeedsRenewal = (issuedAt: number, now = Date.now()) => now - issuedAt > RENEW_AFTER_MS;

export function endSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

/** Returns who the session is for and when it was issued (ms), or null when missing, tampered with or expired. */
export async function readSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0 || payload.iat === undefined) return null;
    return { userId, issuedAt: payload.iat * 1000 };
  } catch {
    return null;
  }
}

/**
 * Whether a session from `issuedAt` predates the user's last password change. `iat` has whole-second
 * precision, so the change is rounded down too: the fresh session handed out with the change stays valid.
 */
export const sessionRevoked = (issuedAt: number, passwordChangedAt: Date | null) =>
  passwordChangedAt !== null && issuedAt < Math.floor(passwordChangedAt.getTime() / 1000) * 1000;
