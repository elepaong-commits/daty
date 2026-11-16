import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { reportError } from "../lib/alerts.js";

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

const isBodyParserError = (err: unknown): err is { status: number } => {
  if (!(err instanceof Error)) return false;
  const { type, status } = err as { type?: unknown; status?: unknown };
  return typeof type === "string" && typeof status === "number" && status >= 400 && status < 500;
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not Found", code: "NOT_FOUND" });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  // Malformed or oversized bodies from express.json (status 400/413/415): the client's fault, not a server error.
  if (isBodyParserError(err)) {
    res.status(err.status).json({ error: "Invalid request body", code: "INVALID_REQUEST" });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Invalid request", code: "INVALID_REQUEST", issues: err.issues });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    res.status(404).json({ error: "Not Found", code: "NOT_FOUND" });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
    res.status(409).json({ error: "Conflict, please retry", code: "CONFLICT" });
    return;
  }
  reportError("server error", `${req.method} ${req.originalUrl}\n${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  res.status(500).json({ error: "Internal Server Error", code: "INTERNAL" });
};
