import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../src/lib/prisma.js";
import { Client, coupleMember, resetDatabase, startServer } from "./helpers.js";

// A day's dates share one album, so a second album on the same day is refused.

let server: Awaited<ReturnType<typeof startServer>>;
let a: Client;
let b: Client;

before(async () => {
  await resetDatabase();
  server = await startServer();
  a = await coupleMember(server.baseUrl, "day-a@test.local");
  b = await coupleMember(server.baseUrl, "day-b@test.local");
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

test("a day can have only one album", async () => {
  await a.ok("POST", "/albums", { title: "First", albumDate: "2026-09-01" });
  const res = await a.request("POST", "/albums", { title: "Second", albumDate: "2026-09-01" });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, "ALBUM_EXISTS");
});

test("moving an album onto a day that has one is refused, keeping its own day is not", async () => {
  await a.ok("POST", "/albums", { title: "Taken", albumDate: "2026-09-02" });
  const album = await a.ok("POST", "/albums", { title: "Mover", albumDate: "2026-09-03" });
  const res = await a.request("PATCH", `/albums/${album.id}`, { albumDate: "2026-09-02" });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, "ALBUM_EXISTS");
  await a.ok("PATCH", `/albums/${album.id}`, { title: "Renamed", albumDate: "2026-09-03" });
});

test("another couple's album doesn't take the day", async () => {
  await a.ok("POST", "/albums", { title: "A's", albumDate: "2026-09-04" });
  await b.ok("POST", "/albums", { title: "B's", albumDate: "2026-09-04" });
});
