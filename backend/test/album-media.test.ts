import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { prisma } from "../src/lib/prisma.js";
import { Client, coupleMember, resetDatabase, startServer } from "./helpers.js";

// Albums hold photos and videos side by side; the client tells them apart by `mediaType`.

let server: Awaited<ReturnType<typeof startServer>>;
let a: Client;

before(async () => {
  await resetDatabase();
  server = await startServer();
  a = await coupleMember(server.baseUrl, "media@test.local");
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

test("a video without a first-frame thumbnail doesn't pass itself off as one", async () => {
  const album = await a.ok("POST", "/albums", { title: "Clips", albumDate: "2026-10-01" });
  await prisma.photo.createMany({
    data: [
      { albumId: album.id, imageUrl: "https://example.com/a.jpg", displayOrder: 1 },
      { albumId: album.id, imageUrl: "https://example.com/b.mp4", displayOrder: 2, mediaType: "VIDEO", durationSec: 12.5 },
    ],
  });
  const { photos } = await a.ok("GET", `/albums/${album.id}`);
  assert.deepEqual(
    photos.map((p: { mediaType: string; durationSec: number | null; thumbnailUrl: string | null }) => [p.mediaType, p.durationSec, p.thumbnailUrl]),
    [
      ["PHOTO", null, "https://example.com/a.jpg"],
      ["VIDEO", 12.5, null],
    ],
  );
});

test("video upload keys are checked like photo keys", async () => {
  const album = await a.ok("POST", "/albums", { title: "Other", albumDate: "2026-10-02" });
  const res = await a.request("POST", `/albums/${album.id}/photos`, {
    photos: [{ key: `couples/0/albums/${album.id}/00000000-0000-0000-0000-000000000000.mov` }],
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, "INVALID_UPLOAD");
});

test("a file already in the album isn't recorded again", async () => {
  const album = await a.ok("POST", "/albums", { title: "Again", albumDate: "2026-10-03" });
  const { coupleId } = await prisma.album.findUniqueOrThrow({ where: { id: album.id } });
  const fingerprint = "a".repeat(64);
  await prisma.photo.create({
    data: { albumId: album.id, storageKey: `couples/${coupleId}/albums/${album.id}/11111111-1111-1111-1111-111111111111.jpg`, fingerprint },
  });
  const key = `couples/${coupleId}/albums/${album.id}/22222222-2222-2222-2222-222222222222.jpg`;
  const res = await a.request("POST", `/albums/${album.id}/photos`, { photos: [{ key, fingerprint }] });
  assert.equal(res.status, 201);
  assert.equal(res.body.photos.length, 1);
  assert.equal(res.body.photos[0].fingerprint, fingerprint);
});
