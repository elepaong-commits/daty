import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { requireCouple } from "./middlewares/couple-context.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { albumsRouter } from "./modules/albums.routes.js";
import { coupleRouter } from "./modules/couple.routes.js";
import { placesRouter } from "./modules/places.routes.js";
import { recordsRouter } from "./modules/records.routes.js";
import { healthRouter } from "./modules/health.routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: env.CORS_ORIGINS }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/health", healthRouter);

  const api = express.Router();
  api.use(requireCouple);
  api.use("/couple", coupleRouter);
  api.use("/places", placesRouter);
  api.use("/records", recordsRouter);
  api.use("/albums", albumsRouter);
  app.use("/api", api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
