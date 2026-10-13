import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { readSession, SESSION_COOKIE, sessionRevoked } from "../lib/session.js";
import { HttpError } from "./error-handler.js";

declare global {
  namespace Express {
    interface Request {
      userId: number;
      coupleId: number;
      /** Set by requireAuth for requireCouple, so a request looks the user up once. */
      userCoupleId: number | null;
    }
  }
}

/** Looks the user up on every request, so a password change logs out other devices right away. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const session = await readSession(req.cookies?.[SESSION_COOKIE]);
  const user =
    session &&
    (await prisma.user.findUnique({ where: { id: session.userId }, select: { coupleId: true, passwordChangedAt: true } }));
  if (!session || !user || sessionRevoked(session.issuedAt, user.passwordChangedAt)) {
    throw new HttpError(401, "Unauthorized", "UNAUTHENTICATED");
  }
  req.userId = session.userId;
  req.userCoupleId = user.coupleId;
  next();
};

/** Use after requireAuth. Read per request so leaving or joining a couple applies immediately. */
export const requireCouple: RequestHandler = (req, _res, next) => {
  if (req.userCoupleId === null) throw new HttpError(403, "Couple not connected", "COUPLE_REQUIRED");
  req.coupleId = req.userCoupleId;
  next();
};
