import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { toDateOnly } from "../lib/http.js";

export const coupleRouter = Router();

coupleRouter.get("/", async (req, res) => {
  const couple = await prisma.couple.findUniqueOrThrow({
    where: { id: req.coupleId },
    include: { users: { select: { id: true, nickname: true, profileImageUrl: true } } },
  });
  res.json({
    id: couple.id,
    anniversaryDate: toDateOnly(couple.anniversaryDate),
    users: couple.users,
  });
});
