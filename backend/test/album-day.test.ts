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

test("a trip album takes every day in its range", async () => {
  const trip = await a.ok("POST", "/albums", { title: "Trip", albumDate: "2026-09-10", albumEndDate: "2026-09-12" });
  assert.equal(trip.albumEndDate, "2026-09-12");
  for (const day of ["2026-09-10", "2026-09-11", "2026-09-12"]) {
    const res = await a.request("POST", "/albums", { title: "Inside", albumDate: day });
    assert.equal(res.status, 409, day);
  }
  const overlapping = await a.request("POST", "/albums", { title: "Overlap", albumDate: "2026-09-08", albumEndDate: "2026-09-10" });
  assert.equal(overlapping.status, 409);
  await a.ok("POST", "/albums", { title: "Before", albumDate: "2026-09-08", albumEndDate: "2026-09-09" });
  await a.ok("POST", "/albums", { title: "After", albumDate: "2026-09-13" });
});

test("a one-day album reports its day as both ends, and a range can't run backwards", async () => {
  const day = await a.ok("POST", "/albums", { title: "Day", albumDate: "2026-09-20", albumEndDate: "2026-09-20" });
  assert.equal(day.albumEndDate, "2026-09-20");
  const backwards = await a.request("POST", "/albums", { title: "Back", albumDate: "2026-09-25", albumEndDate: "2026-09-24" });
  assert.equal(backwards.status, 400);
});

test("stretching an album over a taken day is refused, and null shrinks it back to one day", async () => {
  await a.ok("POST", "/albums", { title: "Taken", albumDate: "2026-09-28" });
  const album = await a.ok("POST", "/albums", { title: "Stretch", albumDate: "2026-09-26" });
  const res = await a.request("PATCH", `/albums/${album.id}`, { albumEndDate: "2026-09-28" });
  assert.equal(res.status, 409);
  const stretched = await a.ok("PATCH", `/albums/${album.id}`, { albumEndDate: "2026-09-27" });
  assert.equal(stretched.albumEndDate, "2026-09-27");
  const shrunk = await a.ok("PATCH", `/albums/${album.id}`, { albumEndDate: null });
  assert.equal(shrunk.albumEndDate, "2026-09-26");
});

test("deleting an album frees its days and keeps its visits on the calendar", async () => {
  const place = await a.ok("POST", "/places", { name: "Trip spot", category: "CAFE" });
  const record = await a.ok("POST", "/records", {
    type: "RECORD",
    scheduledAt: "2026-08-01T12:00:00+09:00",
    category: "CAFE",
    placeId: place.id,
  });
  const album = await a.ok("POST", "/albums", { title: "Gone", albumDate: "2026-08-01", albumEndDate: "2026-08-02", recordIds: [record.id] });
  const res = await a.request("DELETE", `/albums/${album.id}`);
  assert.equal(res.status, 204);
  assert.equal((await a.request("GET", `/albums/${album.id}`)).status, 404);
  const kept = await prisma.dateRecord.findUniqueOrThrow({ where: { id: record.id } });
  assert.equal(kept.albumId, null);
  await a.ok("POST", "/albums", { title: "Again", albumDate: "2026-08-02" });
});
