// Loaded with --import before any test file (see "test" in package.json) so src/config/env.ts sees test settings.
// Tests run against their own database in the local dev container, never daty_dev or production.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://daty:daty@localhost:5433/daty_test?schema=public";
process.env.SESSION_SECRET = "test-session-secret-at-least-32-characters";
// No R2: upload endpoints answer 503 once they get past the ownership checks.
// No mail provider or push keys either: mail lands in an in-memory outbox (src/lib/mail.ts) and nothing is pushed.
for (const key of [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "APP_URL",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
]) {
  delete process.env[key];
}

if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test")) {
  throw new Error("Tests wipe their database, so its name must end with _test");
}
