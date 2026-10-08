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

export function endSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

/** Returns the user id, or null when the token is missing, tampered with or expired. */
export async function readSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}
