import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../middlewares/error-handler.js";
import { prisma } from "../lib/prisma.js";
import { pushPublicKey, sendPush } from "../lib/push.js";
import { timeZoneParam } from "../lib/time.js";

/** Mounted after requireAuth: notifications belong to a person's devices, with or without a couple. */
export const pushRouter = Router();

function requirePush() {
  if (!pushPublicKey) throw new HttpError(503, "Notifications are not configured", "PUSH_DISABLED");
  return pushPublicKey;
}

// The key a browser needs to subscribe.
pushRouter.get("/key", (_req, res) => {
  res.json({ publicKey: requirePush() });
});

const subscriptionBody = z.object({
  endpoint: z.url().max(1000).refine((url) => url.startsWith("https://"), "Push endpoints are https"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  locale: z.enum(["ko", "ja"]),
  timeZone: timeZoneParam,
});

// Called when notifications are turned on, and again on later visits so the language and time zone stay current.
pushRouter.post("/subscriptions", async (req, res) => {
  requirePush();
  const { endpoint, keys, locale, timeZone } = subscriptionBody.parse(req.body);
  const data = { userId: req.userId, ...keys, locale, timeZone };
  // The endpoint is the device: logging in as someone else on it moves the subscription to them.
  await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });
  res.status(204).end();
});

pushRouter.delete("/subscriptions", async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(req.body);
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId } });
  res.status(204).end();
});

// "Send a test" in the settings: goes to every device of the person asking.
pushRouter.post("/test", async (req, res) => {
  requirePush();
  const targets = await prisma.pushSubscription.findMany({ where: { userId: req.userId } });
  await sendPush(targets, (locale) =>
    locale === "ja"
      ? { title: "daty", body: "通知がオンになりました 🔔", url: "/", tag: "test" }
      : { title: "daty", body: "알림이 켜졌어요 🔔", url: "/", tag: "test" },
  );
  res.json({ devices: targets.length });
});
