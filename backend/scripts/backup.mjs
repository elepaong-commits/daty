// Dumps the database and puts the dump in its own R2 bucket (BACKUP_R2_BUCKET, with a token that can
// reach only that bucket) under backups/, then drops dumps older than BACKUP_KEEP_DAYS. Without the
// BACKUP_R2_* settings it falls back to the photo bucket. A failure mails ADMIN_EMAIL when mail is set up.
// Meant for a daily cron on the server (docs/operations.md):
//
//   node --env-file=.env scripts/backup.mjs
//
// Plain JavaScript on purpose: it runs on the server without tsx or a build.
import { spawn } from "node:child_process";
import { AwsClient } from "aws4fetch";

const {
  DATABASE_URL,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  // A bucket of its own, so a leaked photo key can't touch the backups (and the reverse).
  BACKUP_R2_BUCKET,
  BACKUP_R2_ACCESS_KEY_ID,
  BACKUP_R2_SECRET_ACCESS_KEY,
  // Failure mail, through the same Resend settings the API uses.
  RESEND_API_KEY,
  MAIL_FROM,
  ADMIN_EMAIL,
  // The Postgres container pg_dump runs in. Set to an empty string to use a pg_dump installed on this machine.
  BACKUP_DB_CONTAINER = "date_app_postgres",
  BACKUP_KEEP_DAYS = "14",
  // Only for trying the script against another S3-compatible endpoint.
  R2_ENDPOINT,
} = process.env;

const PREFIX = "backups/";
const DAY_MS = 86_400_000;

/** Mails ADMIN_EMAIL about a failed backup; a backup that quietly stops is the one nobody notices. */
async function alert(message) {
  if (!RESEND_API_KEY || !MAIL_FROM || !ADMIN_EMAIL) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [ADMIN_EMAIL], subject: "[daty] backup failed", text: `${message}\n\n${new Date().toISOString()}` }),
    });
    if (!res.ok) console.error(`[backup] alert mail answered ${res.status}`);
  } catch (err) {
    console.error(`[backup] alert mail failed: ${err}`);
  }
}

async function fail(message) {
  console.error(`[backup] ${message}`);
  await alert(message);
  process.exit(1);
}

const separate = Boolean(BACKUP_R2_BUCKET || BACKUP_R2_ACCESS_KEY_ID || BACKUP_R2_SECRET_ACCESS_KEY);
const bucket = separate
  ? { name: BACKUP_R2_BUCKET, accessKeyId: BACKUP_R2_ACCESS_KEY_ID, secretAccessKey: BACKUP_R2_SECRET_ACCESS_KEY }
  : { name: R2_BUCKET, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY };

if (!DATABASE_URL) await fail("DATABASE_URL is not set");
if (!R2_ACCOUNT_ID || !bucket.name || !bucket.accessKeyId || !bucket.secretAccessKey) {
  await fail(separate ? "Set all of BACKUP_R2_BUCKET, BACKUP_R2_ACCESS_KEY_ID, BACKUP_R2_SECRET_ACCESS_KEY" : "R2 settings are missing, nowhere to put the backup");
}
if (!separate) console.warn("[backup] BACKUP_R2_* not set: storing in the photo bucket. See docs/operations.md");

/** Custom-format dump (already compressed; restore with pg_restore). The password travels by environment, not arguments. */
function dump() {
  const db = new URL(DATABASE_URL);
  const args = ["-h", db.hostname, "-p", db.port || "5432", "-U", decodeURIComponent(db.username), "-d", db.pathname.slice(1), "-Fc", "--no-owner"];
  const env = { ...process.env, PGPASSWORD: decodeURIComponent(db.password) };
  const child = BACKUP_DB_CONTAINER
    ? // Inside the container the database is on its own port, whatever the host maps it to.
      spawn("docker", ["exec", "-e", "PGPASSWORD", BACKUP_DB_CONTAINER, "pg_dump", ...args.map((a, i) => (args[i - 1] === "-h" ? "localhost" : args[i - 1] === "-p" ? "5432" : a))], { env })
    : spawn("pg_dump", args, { env });
  return new Promise((resolve, reject) => {
    const chunks = [];
    let stderr = "";
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`pg_dump exited with ${code}: ${stderr.trim()}`))));
  });
}

const r2 = new AwsClient({ accessKeyId: bucket.accessKeyId, secretAccessKey: bucket.secretAccessKey, service: "s3", region: "auto" });
const bucketUrl = `${R2_ENDPOINT ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`}/${bucket.name}`;

async function r2Fetch(path, init) {
  const res = await r2.fetch(`${bucketUrl}${path}`, init);
  if (!res.ok) throw new Error(`R2 ${init?.method ?? "GET"} ${path} answered ${res.status}: ${await res.text()}`);
  return res;
}

const stamp = new Date().toISOString().slice(0, 16).replace(":", ""); // 2026-11-11T0415
const key = `${PREFIX}daty-${stamp}.dump`;

try {
  const data = await dump();
  // An empty database still dumps to a few KB; less means pg_dump produced nothing useful.
  if (data.length < 1000) throw new Error(`The dump is only ${data.length} bytes`);
  await r2Fetch(`/${key}`, { method: "PUT", body: data, headers: { "content-type": "application/octet-stream" } });
  console.log(`[backup] ${key} uploaded (${(data.length / 1024).toFixed(0)} KB)`);

  const listing = await (await r2Fetch(`?list-type=2&prefix=${encodeURIComponent(PREFIX)}`)).text();
  const keys = [...listing.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
  const cutoff = Date.now() - Number(BACKUP_KEEP_DAYS) * DAY_MS;
  for (const old of keys) {
    const day = /daty-(\d{4}-\d{2}-\d{2})T/.exec(old)?.[1];
    if (!day || Date.parse(day) >= cutoff) continue;
    await r2Fetch(`/${old}`, { method: "DELETE" });
    console.log(`[backup] ${old} removed`);
  }
} catch (err) {
  await fail(err instanceof Error ? err.message : String(err));
}
