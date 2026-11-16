import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../src/lib/prisma.js";
import { Client, coupleMember, resetDatabase, startServer } from "./helpers.js";

// A date's own memo stays on the record; a place memo written in the same form goes to the place.

let server: Awaited<ReturnType<typeof startServer>>;
let a: Client;

before(async () => {
  await resetDatabase();
  server = await startServer();
  a = await coupleMember(server.baseUrl, "note-a@test.local");
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

const plan = { type: "PLAN", scheduledAt: "2026-10-01T18:00:00+09:00", category: "CAFE" };

test("creating a record keeps the date memo and adds the place memo to the place", async () => {
  const record = await a.ok("POST", "/records", {
    ...plan,
    placeName: "Note Cafe",
    memo: "Her birthday",
    placeNote: "Window seats upstairs",
  });
  assert.equal(record.memo, "Her birthday");

  const place = await a.ok("GET", `/places/${record.placeId}`);
  assert.deepEqual(
    place.notes.map((note: { content: string }) => note.content),
    ["Window seats upstairs"],
  );
  assert.ok(place.notes[0].writer, "the note keeps who wrote it");
});

test("editing a record adds another place memo without touching the date memo", async () => {
  const record = await a.ok("POST", "/records", { ...plan, placeName: "Edit Cafe", memo: "Anniversary" });
  await a.ok("PATCH", `/records/${record.id}`, { placeNote: "Closed on Mondays" });

  const records = await a.ok("GET", "/records?from=2026-10-01T00:00:00%2B09:00&to=2026-10-02T00:00:00%2B09:00");
  assert.equal(records.find((r: { id: number }) => r.id === record.id).memo, "Anniversary");
  const place = await a.ok("GET", `/places/${record.placeId}`);
  assert.equal(place.notes.length, 1);
  assert.equal(place.notes[0].content, "Closed on Mondays");
});

test("moving a record to another place puts the place memo on the new place", async () => {
  const record = await a.ok("POST", "/records", { ...plan, placeName: "Old Spot" });
  const moved = await a.ok("PATCH", `/records/${record.id}`, { placeName: "New Spot", placeNote: "Better parking" });
  assert.notEqual(moved.placeId, record.placeId);

  const oldPlace = await a.ok("GET", `/places/${record.placeId}`);
  const newPlace = await a.ok("GET", `/places/${moved.placeId}`);
  assert.equal(oldPlace.notes.length, 0);
  assert.equal(newPlace.notes[0].content, "Better parking");
});

test("another branch with the same name gets its own place; a place saved by name is filled in", async () => {
  const branch = (googlePlaceId: string, latitude: number) => ({ ...plan, placeName: "Chain Cafe", googlePlaceId, latitude, longitude: 127 });
  const first = await a.ok("POST", "/records", branch("gp-branch-1", 37.5));
  const second = await a.ok("POST", "/records", branch("gp-branch-2", 37.6));
  assert.notEqual(second.placeId, first.placeId);
  assert.equal((await a.ok("POST", "/records", branch("gp-branch-1", 37.5))).placeId, first.placeId);

  const byName = await a.ok("POST", "/records", { ...plan, placeName: "Typed Cafe" });
  const located = await a.ok("POST", "/records", { ...plan, placeName: "Typed Cafe", googlePlaceId: "gp-typed", latitude: 37.4, longitude: 127 });
  assert.equal(located.placeId, byName.placeId);
  assert.equal((await a.ok("GET", `/places/${byName.placeId}`)).googlePlaceId, "gp-typed");
});

test("a blank place memo is refused", async () => {
  const res = await a.request("POST", "/records", { ...plan, placeName: "Blank Cafe", placeNote: "   " });
  assert.equal(res.status, 400);
});

test("a stop can have an end time, after its start", async () => {
  const at = "2026-12-24T14:00:00+09:00";
  const course = { type: "PLAN", category: "CAFE", placeName: "Course cafe" };
  const stop = await a.ok("POST", "/records", { ...course, scheduledAt: at, endsAt: "2026-12-24T16:00:00+09:00" });
  assert.equal(stop.endsAt, "2026-12-24T07:00:00.000Z");
  const early = await a.request("POST", "/records", { ...course, scheduledAt: at, endsAt: at });
  assert.equal(early.body.code, "ENDS_BEFORE_START");
  // Moving the start past the kept end is refused too; clearing the end is fine.
  const late = await a.request("PATCH", `/records/${stop.id}`, { scheduledAt: "2026-12-24T17:00:00+09:00" });
  assert.equal(late.body.code, "ENDS_BEFORE_START");
  assert.equal((await a.ok("PATCH", `/records/${stop.id}`, { endsAt: null })).endsAt, null);
});
