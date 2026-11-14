import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { prisma } from "../src/lib/prisma.js";
import { Client, coupleMember, resetDatabase, startServer } from "./helpers.js";

// Leaving a couple, removing a partner and deleting an account. The couple's records stay with
// whoever remains; the last one out takes them along.

let server: Awaited<ReturnType<typeof startServer>>;
let a: Client;
let b: Client;
let n = 0;

before(async () => {
  await resetDatabase();
  server = await startServer();
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

/** A fresh couple of two with a place, an album with a photo, and b's reaction and comment on it. */
beforeEach(async () => {
  n++;
  a = await coupleMember(server.baseUrl, `a${n}@test.local`);
  const { coupleCode } = await a.ok("GET", "/couple");
  b = new Client(server.baseUrl);
  await b.ok("POST", "/auth/signup", { email: `b${n}@test.local`, password: "password1234", nickname: "b" });
  await b.ok("POST", "/couple/join", { code: coupleCode });
  await a.ok("POST", "/places", { name: "Cafe", category: "CAFE" });
  const album = await a.ok("POST", "/albums", { title: "Day", albumDate: "2026-10-01" });
  const photo = await prisma.photo.create({ data: { albumId: album.id, imageUrl: "https://example.com/a.jpg" } });
  await b.ok("PUT", `/albums/${album.id}/photos/${photo.id}/reaction`, { emoji: "❤️" });
  await b.ok("POST", `/albums/${album.id}/photos/${photo.id}/comments`, { content: "Nice" });
});

test("leaving keeps the records with the partner and changes the invite code", async () => {
  const { coupleCode, id: coupleId } = await a.ok("GET", "/couple");
  const left = await b.ok("POST", "/couple/leave");
  assert.equal(left.couple, null);
  assert.equal((await b.request("GET", "/places")).body.code, "COUPLE_REQUIRED");

  const [album] = await a.ok("GET", "/albums");
  const detail = await a.ok("GET", `/albums/${album.id}`);
  assert.equal(detail.photos[0].reactions.length, 0, "the leaver's reaction goes");
  assert.equal(detail.photos[0].comments[0].content, "Nice", "what they wrote stays");
  assert.equal((await a.ok("GET", "/places")).length, 1);

  const couple = await a.ok("GET", "/couple");
  assert.equal(couple.users.length, 1);
  assert.notEqual(couple.coupleCode, coupleCode);
  assert.equal((await b.request("POST", "/couple/join", { code: coupleCode })).status, 404, "the old code no longer works");

  // Free to start over.
  await b.ok("POST", "/couple", { anniversaryDate: "2026-01-01" });
  assert.ok(await prisma.couple.findUnique({ where: { id: coupleId } }));
});

test("a partner can be removed, and only when there is one", async () => {
  const me = await a.ok("DELETE", "/couple/partner");
  assert.equal(me.couple.users.length, 1);
  assert.equal((await b.ok("GET", "/auth/me")).couple, null);
  assert.equal((await a.request("DELETE", "/couple/partner")).body.code, "NO_PARTNER");
});

test("the last one out deletes the couple and everything in it", async () => {
  const { id: coupleId } = await a.ok("GET", "/couple");
  await b.ok("POST", "/couple/leave");
  await a.ok("POST", "/couple/leave");
  assert.equal(await prisma.couple.count({ where: { id: coupleId } }), 0);
  assert.equal(await prisma.place.count({ where: { coupleId } }), 0);
  assert.equal(await prisma.album.count({ where: { coupleId } }), 0);
  assert.equal(await prisma.comment.count({ where: { coupleId } }), 0);
});

test("deleting the account needs the password, then leaves and logs out", async () => {
  const wrong = await b.request("DELETE", "/auth/me", { password: "not-it-at-all" });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.code, "WRONG_PASSWORD");

  assert.equal((await b.request("DELETE", "/auth/me", { password: "password1234" })).status, 204);
  assert.equal((await b.request("GET", "/auth/me")).status, 401);
  assert.equal(await prisma.user.count({ where: { email: `b${n}@test.local` } }), 0);

  const [album] = await a.ok("GET", "/albums");
  const detail = await a.ok("GET", `/albums/${album.id}`);
  assert.equal(detail.photos[0].comments[0].content, "Nice");
  assert.equal(detail.photos[0].comments[0].writer, null);
  assert.equal((await a.ok("GET", "/couple")).users.length, 1);
});
