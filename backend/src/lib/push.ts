import * as webpush from "web-push";
import { env } from "../config/env.js";
import { prisma } from "./prisma.js";

// Web push: each device that turned notifications on has a subscription row; the service worker
// (frontend/public/sw.js) shows what is sent here.

export type Locale = "ko" | "ja";

export interface PushMessage {
  title: string;
  body: string;
  /** Screen to open when the notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other on the device. */
  tag?: string;
}

const configured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (configured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT ?? "mailto:admin@localhost", env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

/** The key browsers subscribe with, or `null` when push isn't set up. */
export const pushPublicKey = configured ? env.VAPID_PUBLIC_KEY! : null;

export const toLocale = (value: string): Locale => (value === "ja" ? "ja" : "ko");

interface Target {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
}

/** Best effort: a device that unsubscribed is forgotten, anything else is only logged. */
export async function sendPush(targets: Target[], build: (locale: Locale) => PushMessage) {
  if (!configured) return;
  await Promise.all(
    targets.map(async (target) => {
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          JSON.stringify(build(toLocale(target.locale))),
          { TTL: 86_400 },
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.deleteMany({ where: { id: target.id } });
        } else {
          console.error(`Push to subscription ${target.id} failed:`, status ?? err);
        }
      }
    }),
  );
}

/** Partner notifications during tests, in Korean, newest last; nothing is sent there. */
export const pushOutbox: (PushMessage & { coupleId: number; fromUserId: number })[] = [];

// Photos are recorded one by one as they land, so their notification waits until the uploads go
// quiet and then says how many came in: one notification per batch, not one per photo.
const PHOTO_QUIET_MS = 2 * 60 * 1000;
const photoBatches = new Map<string, { count: number; timer: NodeJS.Timeout }>();

/** Counts photos `fromUserId` added to an album and tells the partner once they stop coming. */
export function notifyPhotosAdded(
  { coupleId, fromUserId, albumId, count }: { coupleId: number; fromUserId: number; albumId: number; count: number },
  build: (locale: Locale, count: number) => PushMessage,
  quietMs = PHOTO_QUIET_MS,
) {
  const key = `${fromUserId}:${albumId}`;
  const batch = photoBatches.get(key);
  if (batch) clearTimeout(batch.timer);
  const total = (batch?.count ?? 0) + count;
  const timer = setTimeout(() => {
    photoBatches.delete(key);
    notifyPartner(coupleId, fromUserId, (locale) => build(locale, total));
  }, quietMs);
  timer.unref();
  photoBatches.set(key, { count: total, timer });
}

/** Tells the other half of the couple about something `fromUserId` just did. Never throws. */
export function notifyPartner(coupleId: number, fromUserId: number, build: (locale: Locale) => PushMessage) {
  if (env.NODE_ENV === "test") pushOutbox.push({ ...build("ko"), coupleId, fromUserId });
  if (!configured) return;
  prisma.pushSubscription
    .findMany({ where: { userId: { not: fromUserId }, user: { coupleId } } })
    .then((targets) => sendPush(targets, build))
    .catch((err: unknown) => console.error("Partner notification failed:", err));
}
