// Dumps the database and puts the dump in the R2 bucket under backups/, then drops dumps older than
// BACKUP_KEEP_DAYS. Meant for a daily cron on the server (docs/operations.md):
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
  // The Postgres container pg_dump runs in. Set to an empty string to use a pg_dump installed on this machine.
  BACKUP_DB_CONTAINER = "date_app_postgres",
  BACKUP_KEEP_DAYS = "14",
  // Only for trying the script against another S3-compatible endpoint.
  R2_ENDPOINT,
} = process.env;

const PREFIX = "backups/";
const DAY_MS = 86_400_000;

function fail(message) {
  console.error(`[backup] ${message}`);
  process.exit(1);
}

if (!DATABASE_URL) fail("DATABASE_URL is not set");
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) fail("R2 settings are missing, nowhere to put the backup");

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

const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
const bucketUrl = `${R2_ENDPOINT ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`}/${R2_BUCKET}`;

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
  fail(err instanceof Error ? err.message : String(err));
}
