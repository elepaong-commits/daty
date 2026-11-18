import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { sweepOrphanUploads } from "../src/lib/orphans.js";
import { prisma } from "../src/lib/prisma.js";
import { coupleMember, resetDatabase, startServer } from "./helpers.js";

// Uploads whose confirm never arrived are deleted once they are a day old; anything a photo uses stays.

let server: Awaited<ReturnType<typeof startServer>>;

before(async () => {
  await resetDatabase();
  server = await startServer();
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

test("only old files no photo or profile refers to are swept", async () => {
  const a = await coupleMember(server.baseUrl, "orphans@test.local");
  const album = await a.ok("POST", "/albums", { title: "Day", albumDate: "2026-10-01" });
  const prefix = `couples/1/albums/${album.id}`;
  await prisma.photo.createMany({
    data: [
      { albumId: album.id, storageKey: `${prefix}/kept.jpg`, thumbnailKey: `${prefix}/kept.thumb.jpg` },
      { albumId: album.id, imageUrl: `https://bucket.example.com/${prefix}/legacy.jpg` },
    ],
  });

  const me = await prisma.user.findUniqueOrThrow({ where: { email: "orphans@test.local" }, select: { id: true } });
  const avatar = `avatars/${me.id}/00000000-0000-4000-8000-000000000001.jpg`;
  const unconfirmed = `avatars/${me.id}/00000000-0000-4000-8000-000000000002.jpg`;
  await prisma.user.update({ where: { id: me.id }, data: { profileImageUrl: avatar } });

  const now = Date.UTC(2026, 10, 13);
  const old = new Date(now - 2 * 24 * 60 * 60 * 1000);
  const recent = new Date(now - 60 * 60 * 1000);
  const objects = [
    { key: `${prefix}/kept.jpg`, lastModified: old },
    { key: `${prefix}/kept.thumb.jpg`, lastModified: old },
    { key: `${prefix}/legacy.jpg`, lastModified: old },
    { key: `${prefix}/abandoned.mp4`, lastModified: old },
    { key: `${prefix}/abandoned.thumb.jpg`, lastModified: old },
    { key: `${prefix}/uploading.jpg`, lastModified: recent },
    { key: avatar, lastModified: old },
    { key: unconfirmed, lastModified: old },
  ];
  const removed: string[] = [];
  async function* pages() {
    yield objects.slice(0, 3);
    yield objects.slice(3, 6);
    yield objects.slice(6);
  }
  const count = await sweepOrphanUploads({ pages: pages(), remove: async (keys) => void removed.push(...keys), now });
  assert.equal(count, 3);
  assert.deepEqual(removed, [`${prefix}/abandoned.mp4`, `${prefix}/abandoned.thumb.jpg`, unconfirmed]);
});
