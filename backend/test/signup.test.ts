import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { Client, resetDatabase, startServer } from "./helpers.js";

// Signing up is closed unless SIGNUP_ENABLED is on (the tests turn it on in env.ts).

let server: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  await resetDatabase();
  server = await startServer();
});

after(async () => {
  env.SIGNUP_ENABLED = true;
  await server?.close();
  await prisma.$disconnect();
});

test("a closed signup refuses new accounts and says so to the login screen", async () => {
  const client = new Client(server.baseUrl);
  assert.deepEqual(await client.ok("GET", "/auth/signup"), { open: true });

  env.SIGNUP_ENABLED = false;
  assert.deepEqual(await client.ok("GET", "/auth/signup"), { open: false });
  const res = await client.request("POST", "/auth/signup", { email: "closed@test.local", password: "password1234", nickname: "c" });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, "SIGNUP_CLOSED");
  assert.equal(await prisma.user.count({ where: { email: "closed@test.local" } }), 0);
});
