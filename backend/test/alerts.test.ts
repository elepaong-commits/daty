import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { env } from "../src/config/env.js";
import { reportError } from "../src/lib/alerts.js";
import { outbox } from "../src/lib/mail.js";
import { prisma } from "../src/lib/prisma.js";
import { Client, resetDatabase, startServer } from "./helpers.js";

// Errors nobody would otherwise see reach ADMIN_EMAIL, at most once an hour per kind.

let server: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  await resetDatabase();
  server = await startServer();
  env.ADMIN_EMAIL = "admin@test.local";
});

afterEach(() => {
  outbox.length = 0;
});

after(async () => {
  env.ADMIN_EMAIL = undefined;
  await server?.close();
  await prisma.$disconnect();
});

const silently = <T>(fn: () => T) => {
  const original = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = original;
  }
};

test("one mail per kind an hour", () => {
  const now = Date.UTC(2030, 0, 1);
  silently(() => {
    reportError("throttle check", "first", now);
    reportError("throttle check", "second", now + 30 * 60 * 1000);
    reportError("another kind", "else", now);
    reportError("throttle check", "third", now + 61 * 60 * 1000);
  });
  assert.deepEqual(
    outbox.map((m) => [m.to, m.subject, m.text.split("\n")[0]]),
    [
      ["admin@test.local", "[daty] throttle check", "first"],
      ["admin@test.local", "[daty] another kind", "else"],
      ["admin@test.local", "[daty] throttle check", "third"],
    ],
  );
});

test("the app reports its own errors, without logging in", async () => {
  const client = new Client(server.baseUrl);
  const res = await silently(() =>
    client.request("POST", "/client-errors", { message: "Cannot read x of undefined", url: "/albums/3", stack: "at Album" }),
  );
  assert.equal(res.status, 204);
  assert.equal(outbox[0]?.subject, "[daty] app error");
  assert.match(outbox[0]!.text, /Cannot read x of undefined\nat \/albums\/3/);
  assert.equal((await client.request("POST", "/client-errors", { message: "" })).status, 400);
});
