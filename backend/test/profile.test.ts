import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../src/lib/prisma.js";
import { Client, coupleMember, resetDatabase, startServer } from "./helpers.js";

let server: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  await resetDatabase();
  server = await startServer();
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

test("changes the nickname, trimmed", async () => {
  const a = await coupleMember(server.baseUrl, "nick@test.local");
  const me = await a.ok("PATCH", "/auth/me", { nickname: "  새 이름 " });
  assert.equal(me.user.nickname, "새 이름");
  assert.equal(me.couple.users[0].nickname, "새 이름");
});

test("refuses a blank or too long nickname", async () => {
  const a = await coupleMember(server.baseUrl, "nick-bad@test.local");
  assert.equal((await a.request("PATCH", "/auth/me", { nickname: "   " })).status, 400);
  assert.equal((await a.request("PATCH", "/auth/me", { nickname: "가".repeat(21) })).status, 400);
});

test("changes the couple's anniversary", async () => {
  const a = await coupleMember(server.baseUrl, "anniv@test.local");
  const me = await a.ok("PATCH", "/couple", { anniversaryDate: "2023-02-14" });
  assert.equal(me.couple.anniversaryDate, "2023-02-14");
  assert.equal((await a.ok("GET", "/couple")).anniversaryDate, "2023-02-14");
  assert.equal((await a.request("PATCH", "/couple", { anniversaryDate: "2023-02-30" })).status, 400);
});

test("only a couple member can change the anniversary", async () => {
  const solo = new Client(server.baseUrl);
  await solo.ok("POST", "/auth/signup", { email: "solo@test.local", password: "password1234", nickname: "solo" });
  const res = await solo.request("PATCH", "/couple", { anniversaryDate: "2023-02-14" });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, "COUPLE_REQUIRED");
});
