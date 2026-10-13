import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { prisma } from "../src/lib/prisma.js";
import { Client, coupleMember, resetDatabase, startServer } from "./helpers.js";

// Every couple-owned route must treat another couple's ids as if they didn't exist (CLAUDE.md: "커플 데이터
// 쿼리는 반드시 req.coupleId로 범위를 제한한다"). Couple A owns some data; couple B pokes at it.

let server: Awaited<ReturnType<typeof startServer>>;
let a: Client;
let b: Client;
const own = { placeId: 0, noteId: 0, recordId: 0, albumId: 0, photoId: 0, coupleId: 0 };

before(async () => {
  await resetDatabase();
  server = await startServer();
  a = await coupleMember(server.baseUrl, "a@test.local");
  b = await coupleMember(server.baseUrl, "b@test.local");

  const place = await a.ok("POST", "/places", { name: "A's cafe", category: "CAFE", note: "A's note" });
  const detail = await a.ok("GET", `/places/${place.id}`);
  const record = await a.ok("POST", "/records", {
    type: "RECORD",
    scheduledAt: "2026-10-01T12:00:00+09:00",
    category: "CAFE",
    placeId: place.id,
  });
  const album = await a.ok("POST", "/albums", { title: "A's day", albumDate: "2026-10-01", recordIds: [record.id] });
  const photo = await prisma.photo.create({ data: { albumId: album.id, imageUrl: "https://example.com/a.jpg" } });
  const me = await a.ok("GET", "/auth/me");
  Object.assign(own, {
    placeId: place.id,
    noteId: detail.notes[0].id,
    recordId: record.id,
    albumId: album.id,
    photoId: photo.id,
    coupleId: me.couple.id,
  });
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

describe("another couple's ids are not found", () => {
  const cases: [string, () => string, unknown?][] = [
    ["GET", () => `/places/${own.placeId}`],
    ["PATCH", () => `/places/${own.placeId}`, { name: "taken" }],
    ["DELETE", () => `/places/${own.placeId}`],
    ["POST", () => `/places/${own.placeId}/notes`, { content: "hi" }],
    ["DELETE", () => `/places/${own.placeId}/notes/${own.noteId}`],
    ["PATCH", () => `/records/${own.recordId}`, { memo: "taken" }],
    ["DELETE", () => `/records/${own.recordId}`],
    ["GET", () => `/albums/${own.albumId}`],
    ["PATCH", () => `/albums/${own.albumId}`, { title: "taken" }],
    ["DELETE", () => `/albums/${own.albumId}`],
    ["DELETE", () => `/albums/${own.albumId}/photos/${own.photoId}`],
    ["POST", () => `/albums/${own.albumId}/photos/uploads`, { files: [{ contentType: "image/jpeg" }] }],
  ];
  for (const [method, path, body] of cases) {
    test(`${method} ${path().replace(/\d+/g, ":id")}`, async () => {
      const res = await b.request(method, path(), body);
      assert.equal(res.status, 404, JSON.stringify(res.body));
    });
  }
});

describe("another couple's ids can't be linked into your own data", () => {
  test("record at their place", async () => {
    const res = await b.request("POST", "/records", {
      type: "PLAN",
      scheduledAt: "2026-10-20T12:00:00+09:00",
      category: "CAFE",
      placeId: own.placeId,
    });
    assert.equal(res.status, 404);
  });

  test("moving your record to their place", async () => {
    const mine = await b.ok("POST", "/records", {
      type: "PLAN",
      scheduledAt: "2026-10-20T12:00:00+09:00",
      category: "FOOD",
      placeName: "B's restaurant",
    });
    const res = await b.request("PATCH", `/records/${mine.id}`, { placeId: own.placeId });
    assert.equal(res.status, 404);
  });

  test("album with their records or places", async () => {
    const withRecords = await b.request("POST", "/albums", { title: "x", albumDate: "2026-10-01", recordIds: [own.recordId] });
    assert.equal(withRecords.status, 404);
    const mine = await b.ok("POST", "/albums", { title: "B's day", albumDate: "2026-10-01" });
    const withPlaces = await b.request("PATCH", `/albums/${mine.id}`, {
      placeIds: [own.placeId],
      visitAt: "2026-10-01T12:00:00+09:00",
    });
    assert.equal(withPlaces.status, 404);
    const withCover = await b.request("PATCH", `/albums/${mine.id}`, { coverPhotoId: own.photoId });
    assert.equal(withCover.status, 404);
  });

  test("registering photo keys under their couple", async () => {
    const mine = await b.ok("POST", "/albums", { title: "B's other day", albumDate: "2026-10-02" });
    const key = `couples/${own.coupleId}/albums/${own.albumId}/00000000-0000-0000-0000-000000000000.jpg`;
    const res = await b.request("POST", `/albums/${mine.id}/photos`, { photos: [{ key }] });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "INVALID_UPLOAD");
  });
});

describe("lists only show your own couple's data", () => {
  test("places, records and albums", async () => {
    const places = await b.ok("GET", "/places");
    const records = await b.ok("GET", "/records?from=2026-01-01T00:00:00Z&to=2027-01-01T00:00:00Z");
    const albums = await b.ok("GET", "/albums");
    assert.ok(!places.some((p: { id: number }) => p.id === own.placeId));
    assert.ok(!records.some((r: { id: number }) => r.id === own.recordId));
    assert.ok(!albums.some((al: { id: number }) => al.id === own.albumId));
  });
});

test("couple A's data is untouched", async () => {
  const place = await a.ok("GET", `/places/${own.placeId}`);
  assert.equal(place.name, "A's cafe");
  assert.equal(place.notes.length, 1);
  const album = await a.ok("GET", `/albums/${own.albumId}`);
  assert.equal(album.title, "A's day");
  assert.deepEqual(album.recordIds, [own.recordId]);
  assert.equal(album.photos.length, 1);
});

test("couple routes need a login and a couple", async () => {
  const anonymous = await new Client(server.baseUrl).request("GET", "/places");
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.body.code, "UNAUTHENTICATED");

  const single = new Client(server.baseUrl);
  await single.ok("POST", "/auth/signup", { email: "single@test.local", password: "password1234", nickname: "single" });
  const res = await single.request("GET", "/places");
  assert.equal(res.status, 403);
  assert.equal(res.body.code, "COUPLE_REQUIRED");
});
