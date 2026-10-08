import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { readSession, SESSION_COOKIE } from "../lib/session.js";
import { HttpError } from "./error-handler.js";

declare global {
  namespace Express {
    interface Request {
      userId: number;
      coupleId: number;
    }
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const userId = await readSession(req.cookies?.[SESSION_COOKIE]);
  if (userId === null) throw new HttpError(401, "Unauthorized", "UNAUTHENTICATED");
  req.userId = userId;
  next();
};

/** Use after requireAuth. Looked up per request so leaving or joining a couple applies immediately. */
export const requireCouple: RequestHandler = async (req, _res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { coupleId: true } });
  if (!user) throw new HttpError(401, "Unauthorized", "UNAUTHENTICATED");
  if (user.coupleId === null) throw new HttpError(403, "Couple not connected", "COUPLE_REQUIRED");
  req.coupleId = user.coupleId;
  next();
};
