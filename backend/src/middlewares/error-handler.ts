import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Stable machine-readable reason the client can branch on, e.g. `COUPLE_REQUIRED`. */
    readonly code?: string,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not Found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Invalid request", issues: err.issues });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
    res.status(409).json({ error: "Conflict, please retry", code: "CONFLICT" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
};
