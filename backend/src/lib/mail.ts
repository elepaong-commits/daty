import { env } from "../config/env.js";

// Mail goes out through Resend's HTTP API with plain fetch (no SDK, to keep the 1GB server light).

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Mail sent during tests, newest last; nothing leaves the machine there. */
export const outbox: Mail[] = [];

const testing = env.NODE_ENV === "test";

export const mailEnabled = testing || Boolean(env.RESEND_API_KEY && env.MAIL_FROM && env.APP_URL);

/** Frontend address for links in emails. */
export const appUrl = (path: string) => new URL(path, env.APP_URL ?? "http://localhost:5173").href;

export async function sendMail(mail: Mail) {
  if (testing) {
    outbox.push(mail);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text }),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}: ${await res.text()}`);
}
