import { env } from "../config/env.js";
import { mailEnabled, sendMail } from "./mail.js";

// Something went wrong that nobody would otherwise notice: it goes to the log, and to ADMIN_EMAIL when
// that and mail are set up. At most one mail per kind an hour, so a loop of failures can't flood the inbox.

const MAIL_EVERY_MS = 60 * 60 * 1000;
const lastMailed = new Map<string, number>();

export function reportError(kind: string, detail: string, now = Date.now()) {
  console.error(`[${kind}] ${detail}`);
  if (!env.ADMIN_EMAIL || !mailEnabled) return;
  if (now - (lastMailed.get(kind) ?? -Infinity) < MAIL_EVERY_MS) return;
  lastMailed.set(kind, now);
  const text = `${detail}\n\n${new Date(now).toISOString()} · more of the same within the hour only goes to the server log.`;
  sendMail({ to: env.ADMIN_EMAIL, subject: `[daty] ${kind}`, text }).catch((err: unknown) =>
    console.error("Alert mail failed:", err),
  );
}
