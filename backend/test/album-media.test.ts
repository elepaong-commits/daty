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

test("the album list carries a card's worth of photos, cover first, and the counts", async () => {
  const album = await a.ok("POST", "/albums", { title: "Many", albumDate: "2026-10-05" });
  await prisma.photo.createMany({
    data: [1, 2, 3, 4, 5].map((n) => ({
      albumId: album.id,
      imageUrl: `https://example.com/${n}.${n === 2 ? "mp4" : "jpg"}`,
      displayOrder: n,
      mediaType: n === 2 ? ("VIDEO" as const) : ("PHOTO" as const),
    })),
  });
  const photos = await prisma.photo.findMany({ where: { albumId: album.id }, orderBy: { displayOrder: "asc" } });
  const user = await prisma.user.findFirstOrThrow({ where: { email: "media@test.local" } });
  await prisma.reaction.create({ data: { photoId: photos[0]!.id, userId: user.id, coupleId: user.coupleId!, emoji: "❤️" } });
  await a.ok("PATCH", `/albums/${album.id}`, { coverPhotoId: photos[4]!.id });

  const listed = (await a.ok("GET", "/albums")).find((x: { id: number }) => x.id === album.id);
  assert.equal(listed.photoCount, 5);
  assert.equal(listed.videoCount, 1);
  assert.equal(listed.coverPhoto.id, photos[4]!.id);
  assert.deepEqual(
    listed.previewPhotos.map((p: { id: number }) => p.id),
    [photos[4]!.id, photos[0]!.id, photos[1]!.id],
  );
  assert.equal(listed.photos, undefined);
  assert.equal(listed.previewPhotos[1].reactions, undefined);
});

test("photos can be captioned, reordered and moved to another album", async () => {
  const from = await a.ok("POST", "/albums", { title: "From", albumDate: "2026-10-20" });
  const to = await a.ok("POST", "/albums", { title: "To", albumDate: "2026-10-21" });
  await prisma.photo.createMany({
    data: [1, 2, 3].map((n) => ({ albumId: from.id, imageUrl: `https://example.com/m${n}.jpg`, displayOrder: n, fingerprint: `f${n}`.padEnd(64, "0") })),
  });
  const [p1, p2, p3] = await prisma.photo.findMany({ where: { albumId: from.id }, orderBy: { displayOrder: "asc" } });
  const user = await prisma.user.findFirstOrThrow({ where: { email: "media@test.local" } });
  await prisma.reaction.create({ data: { photoId: p3!.id, userId: user.id, coupleId: user.coupleId!, emoji: "❤️" } });
  await a.ok("PATCH", `/albums/${from.id}`, { coverPhotoId: p3!.id });

  const captioned = await a.ok("PATCH", `/albums/${from.id}/photos/${p1!.id}`, { caption: "  Sunset  " });
  assert.equal(captioned.photos[0].caption, "Sunset");

  const reordered = await a.ok("PUT", `/albums/${from.id}/photos/order`, { photoIds: [p3!.id, p1!.id, p2!.id] });
  assert.deepEqual(reordered.photos.map((p: { id: number }) => p.id), [p3!.id, p1!.id, p2!.id]);
  assert.equal((await a.request("PUT", `/albums/${from.id}/photos/order`, { photoIds: [p1!.id, p2!.id] })).status, 400);

  // The cover moves out with its reactions; the album it left loses it as cover.
  const left = await a.ok("PATCH", `/albums/${from.id}/photos/${p3!.id}`, { albumId: to.id });
  assert.equal(left.coverPhotoId, null);
  assert.equal(left.photos.length, 2);
  const arrived = await a.ok("GET", `/albums/${to.id}`);
  assert.equal(arrived.photos[0].id, p3!.id);
  assert.equal(arrived.photos[0].reactions.length, 1);

  // A file the target already has stays put.
  await prisma.photo.create({ data: { albumId: to.id, imageUrl: "https://example.com/dup.jpg", fingerprint: p1!.fingerprint } });
  const dup = await a.request("PATCH", `/albums/${from.id}/photos/${p1!.id}`, { albumId: to.id });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.code, "PHOTO_EXISTS");
});
