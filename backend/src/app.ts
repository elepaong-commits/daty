import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { requireAuth, requireCouple } from "./middlewares/auth.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { albumsRouter } from "./modules/albums.routes.js";
import { authRouter } from "./modules/auth.routes.js";
import { coupleRouter } from "./modules/couple.routes.js";
import { healthRouter } from "./modules/health.routes.js";
import { placesRouter } from "./modules/places.routes.js";
import { recordsRouter } from "./modules/records.routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/health", healthRouter);

  const api = express.Router();
  api.use("/auth", authRouter);
  api.use("/couple", requireAuth, coupleRouter);

  // Couple-owned data: every query inside is scoped to req.coupleId.
  api.use("/places", requireAuth, requireCouple, placesRouter);
  api.use("/records", requireAuth, requireCouple, recordsRouter);
  api.use("/albums", requireAuth, requireCouple, albumsRouter);

  app.use("/api", api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
