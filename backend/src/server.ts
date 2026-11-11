import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startNotifier } from "./lib/notifier.js";
import { prisma } from "./lib/prisma.js";

const server = createApp().listen(env.PORT, env.HOST, () => {
  console.log(`API listening on http://${env.HOST}:${env.PORT}`);
});

startNotifier();

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
