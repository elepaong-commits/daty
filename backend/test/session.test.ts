import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { SignJWT } from "jose";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { coupleMember, resetDatabase, startServer } from "./helpers.js";

// Sessions slide: in use, they are renewed instead of running out 30 days after logging in.

let server: Awaited<ReturnType<typeof startServer>>;
let userId = 0;

before(async () => {
  await resetDatabase();
  server = await startServer();
  await coupleMember(server.baseUrl, "session@test.local");
  ({ id: userId } = await prisma.user.findUniqueOrThrow({ where: { email: "session@test.local" } }));
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

const tokenIssued = (daysAgo: number) => {
  const iat = Math.floor(Date.now() / 1000) - daysAgo * 24 * 60 * 60;
  return new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt(iat)
    .setExpirationTime(iat + 30 * 24 * 60 * 60)
    .sign(new TextEncoder().encode(env.SESSION_SECRET));
};

const me = async (token: string) =>
  fetch(`${server.baseUrl}/auth/me`, { headers: { cookie: `daty_session=${token}` } });

test("a session more than a day old is renewed for another 30 days", async () => {
  const res = await me(await tokenIssued(29));
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^daty_session=/);
  assert.match(cookie, /Max-Age=2592000/);
});

test("a fresh session is left as it is", async () => {
  const res = await me(await tokenIssued(0));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("set-cookie"), null);
});

test("an expired session is not brought back", async () => {
  const res = await me(await tokenIssued(31));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("set-cookie"), null);
});
