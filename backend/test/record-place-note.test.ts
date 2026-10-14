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

test("a blank place memo is refused", async () => {
  const res = await a.request("POST", "/records", { ...plan, placeName: "Blank Cafe", placeNote: "   " });
  assert.equal(res.status, 400);
});
