import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { prisma } from "../src/lib/prisma.js";
import { notifyPhotosAdded, pushOutbox } from "../src/lib/push.js";
import { Client, coupleMember, resetDatabase, startServer } from "./helpers.js";

// What the partner hears about: new plans and records, places to go, and photos (one notice per batch).

let server: Awaited<ReturnType<typeof startServer>>;
let a: Client;

before(async () => {
  await resetDatabase();
  server = await startServer();
  a = await coupleMember(server.baseUrl, "notify@test.local");
  await a.ok("PATCH", "/auth/me", { nickname: "토끼" });
});

beforeEach(() => {
  pushOutbox.length = 0;
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

test("a new plan or record tells the partner, and keeps who wrote it", async () => {
  const plan = await a.ok("POST", "/records", {
    type: "PLAN",
    scheduledAt: "2026-12-24T18:00:00+09:00",
    category: "FOOD",
    placeName: "Bistro",
  });
  await a.ok("POST", "/records", { type: "RECORD", scheduledAt: "2026-11-01T12:00:00+09:00", category: "CAFE", placeName: "Cafe" });
  assert.deepEqual(
    pushOutbox.map((m) => [m.title, m.body, m.url]),
    [
      ["토끼님이 새 일정을 잡았어요", "Bistro", "/calendar"],
      ["토끼님이 데이트 기록을 남겼어요", "Cafe", "/calendar"],
    ],
  );
  const { writerId } = await prisma.dateRecord.findUniqueOrThrow({ where: { id: plan.id } });
  assert.equal(writerId, pushOutbox[0]!.fromUserId);
});

test("a place to go tells the partner; a visited one doesn't", async () => {
  const wish = await a.ok("POST", "/places", { name: "Tower", category: "TOUR", status: "WISH" });
  await a.ok("POST", "/places", { name: "Old haunt", category: "FOOD", status: "VISITED" });
  assert.deepEqual(
    pushOutbox.map((m) => [m.title, m.body, m.url]),
    [["토끼님이 가고 싶은 곳을 추가했어요", "Tower", `/places/${wish.id}`]],
  );
});

test("photos coming in one by one make one notice once they stop", async () => {
  const build = (_: string, count: number) => ({ title: `${count}`, body: "", url: "/albums/1" });
  for (let i = 0; i < 3; i++) notifyPhotosAdded({ coupleId: 1, fromUserId: 1, albumId: 1, count: 1 }, build, 50);
  notifyPhotosAdded({ coupleId: 1, fromUserId: 1, albumId: 2, count: 2 }, build, 50);
  assert.equal(pushOutbox.length, 0);
  await sleep(120);
  assert.deepEqual(pushOutbox.map((m) => m.title).sort(), ["2", "3"]);
});
