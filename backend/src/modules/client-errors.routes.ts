import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import { reportError } from "../lib/alerts.js";

// Errors from the browser (a crashed screen, an uncaught error), so they don't go unseen.
// No login needed (the login screen can break too), so it is rate limited and trimmed.
export const clientErrorsRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts", code: "RATE_LIMITED" },
});

const body = z.object({
  message: z.string().trim().min(1).max(500),
  stack: z.string().max(4000).optional(),
  url: z.string().max(500).optional(),
  userAgent: z.string().max(300).optional(),
});

clientErrorsRouter.post("/", limiter, (req, res) => {
  const { message, stack, url, userAgent } = body.parse(req.body);
  reportError("app error", [message, url && `at ${url}`, userAgent, stack].filter(Boolean).join("\n"));
  res.status(204).end();
});
