import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not Found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Invalid request", issues: err.issues });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
};
