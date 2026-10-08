import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "./error-handler.js";

declare global {
  namespace Express {
    interface Request {
      coupleId: number;
    }
  }
}

let devCoupleId: number | undefined;

// TODO(auth): resolve the couple from the logged-in user instead of DEV_COUPLE_CODE.
export const requireCouple: RequestHandler = async (req, _res, next) => {
  if (env.NODE_ENV === "production" || env.DEV_COUPLE_CODE === undefined) {
    throw new HttpError(401, "Unauthorized");
  }
  if (devCoupleId === undefined) {
    const couple = await prisma.couple.findUnique({ where: { coupleCode: env.DEV_COUPLE_CODE } });
    if (!couple) throw new HttpError(401, `Dev couple "${env.DEV_COUPLE_CODE}" not found. Run npx prisma db seed`);
    devCoupleId = couple.id;
  }
  req.coupleId = devCoupleId;
  next();
};
