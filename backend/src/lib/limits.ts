import type { Request } from "express";
import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

// Guessing limits for passwords and codes. Each guarded route counts failures twice: per client IP, and
// per account (the email typed in, or the logged-in user). The IP is only as good as TRUST_PROXY
// (docs/operations.md) and can be faked by calling the API directly past a proxy, so the account
// count is what still holds then.

const WINDOW_MS = 15 * 60 * 1000;

interface LimitOptions {
  /** What is counted against; the client IP when left out. */
  key?: (req: Request) => string;
  /** Requests that aren't counted at all. */
  skip?: (req: Request) => boolean;
  /** Count every request, not only the failed ones. */
  all?: boolean;
}

/** Failed requests allowed per key in 15 minutes. Tests fail on purpose more often, so they get more room. */
export const failureLimiter = (limit: number, { key, skip, all = false }: LimitOptions = {}) =>
  rateLimit({
    windowMs: WINDOW_MS,
    limit: env.NODE_ENV === "test" ? 1000 : limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: !all,
    message: { error: "Too many attempts", code: "RATE_LIMITED" },
    ...(key && { keyGenerator: key }),
    ...(skip && { skip }),
  });

const requestEmail = (req: Request) => {
  const email: unknown = req.body?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : null;
};

/**
 * Per account, by the email a request names. Requests without one (a mailed reset token, which is far
 * too long to guess) are left to the IP limit, so they don't all share one count.
 */
export const accountLimiter = (limit: number) =>
  failureLimiter(limit, { key: (req) => `email:${requestEmail(req)}`, skip: (req) => !requestEmail(req) });

/** Per logged-in user. Use after requireAuth. */
export const userLimiter = (limit: number) => failureLimiter(limit, { key: (req) => `user:${req.userId}` });
