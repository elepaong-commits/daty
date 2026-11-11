import { buildDigest, type DigestInput } from "./digest.js";
import { toDateOnly } from "./http.js";
import { prisma } from "./prisma.js";
import { pushPublicKey, sendPush, toLocale } from "./push.js";
import { isTimeZone, localParts } from "./time.js";

// Runs inside the one API process (the server has no room for a second one): every few minutes it looks
// for devices whose local morning has come and that haven't had today's notification yet.

const TICK_MS = 10 * 60 * 1000;
const MORNING_HOUR = 9;
const EVENING_HOUR = 21; // a device that subscribes late at night waits for the next morning
const DAY_MS = 86_400_000;

async function digestInput(coupleId: number, anniversaryDate: Date, timeZone: string, now: Date): Promise<DigestInput> {
  const [plans, visits] = await Promise.all([
    prisma.dateRecord.findMany({
      where: { coupleId, type: "PLAN", scheduledAt: { gte: new Date(now.getTime() - DAY_MS), lt: new Date(now.getTime() + 3 * DAY_MS) } },
      select: { title: true, scheduledAt: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.dateRecord.findMany({
      where: { coupleId, type: "RECORD", scheduledAt: { lt: new Date(now.getTime() - 300 * DAY_MS) } },
      select: { title: true, scheduledAt: true },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);
  const local = (r: { title: string; scheduledAt: Date }) => ({ title: r.title, date: localParts(r.scheduledAt, timeZone).date });
  return {
    today: localParts(now, timeZone).date,
    anniversaryDate: toDateOnly(anniversaryDate),
    plans: plans.map(local),
    visits: visits.map(local),
  };
}

export async function sendDailyDigests(now = new Date()) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { user: { coupleId: { not: null } } },
    include: { user: { select: { couple: { select: { id: true, anniversaryDate: true } } } } },
  });
  const inputs = new Map<string, Promise<DigestInput>>();
  for (const subscription of subscriptions) {
    const couple = subscription.user.couple;
    if (!couple) continue;
    const timeZone = isTimeZone(subscription.timeZone) ? subscription.timeZone : "Asia/Seoul";
    const { date, hour } = localParts(now, timeZone);
    if (hour < MORNING_HOUR || hour >= EVENING_HOUR || subscription.lastDailyOn === date) continue;
    // Claim the day first so an overlapping run can't send it twice.
    const claimed = await prisma.pushSubscription.updateMany({
      where: { id: subscription.id, OR: [{ lastDailyOn: null }, { lastDailyOn: { not: date } }] },
      data: { lastDailyOn: date },
    });
    if (claimed.count === 0) continue;
    const key = `${couple.id}|${timeZone}`;
    if (!inputs.has(key)) inputs.set(key, digestInput(couple.id, couple.anniversaryDate, timeZone, now));
    const messages = buildDigest(await inputs.get(key)!, toLocale(subscription.locale));
    for (const message of messages) await sendPush([subscription], () => message);
  }
}

/** Starts the morning notifications; does nothing when push isn't configured. */
export function startNotifier() {
  if (!pushPublicKey) return;
  const run = () => sendDailyDigests().catch((err: unknown) => console.error("Daily notifications failed:", err));
  setInterval(run, TICK_MS).unref();
  run();
}
