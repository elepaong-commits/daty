import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { areaOf } from "../src/lib/area.js";
import { buildDigest, milestonesOn } from "../src/lib/digest.js";
import { prisma } from "../src/lib/prisma.js";
import { localParts } from "../src/lib/time.js";
import { type Client, coupleMember, resetDatabase, startServer } from "./helpers.js";

let server: Awaited<ReturnType<typeof startServer>>;
let a: Client;

const visit = (placeName: string, scheduledAt: string, extra: object = {}) =>
  a.ok("POST", "/records", { type: "RECORD", category: "CAFE", placeName, scheduledAt, ...extra });

before(async () => {
  await resetDatabase();
  server = await startServer();
  a = await coupleMember(server.baseUrl, "a@test.local");
  await visit("Old cafe", "2024-10-04T15:00:00+09:00", { rating: 5, address: "대한민국 서울특별시 마포구 양화로 1" });
  // Late evening in Seoul is still the 4th there but already the 5th in UTC... and the other way round at dawn.
  await visit("Dawn bakery", "2025-10-04T01:00:00+09:00", { category: "DESSERT", rating: 3 });
  await visit("Old cafe", "2025-10-04T19:00:00+09:00", { rating: 4, address: "대한민국 서울특별시 마포구 양화로 1" });
  await visit("Tokyo tower", "2025-12-31T23:30:00+09:00", { category: "TOUR", address: "日本、〒105-0011 東京都港区芝公園４丁目２−８" });
  await visit("New year shrine", "2026-01-01T00:30:00+09:00", { category: "TOUR" });
  await a.ok("POST", "/albums", { title: "Trip", albumDate: "2025-10-03", albumEndDate: "2025-10-05" });
  await a.ok("POST", "/albums", { title: "Everyday", albumMonth: "2025-10" });
});

after(async () => {
  await server?.close();
  await prisma.$disconnect();
});

describe("N years ago today", () => {
  test("groups visits and albums by year, newest first, in the viewer's time zone", async () => {
    const memories = await a.ok("GET", "/memories?date=2026-10-04&tz=Asia/Seoul");
    assert.deepEqual(memories.map((m: { yearsAgo: number }) => m.yearsAgo), [1, 2]);
    assert.deepEqual(memories[0].records.map((r: { title: string }) => r.title), ["Dawn bakery", "Old cafe"]);
    assert.deepEqual(memories[0].albums.map((al: { title: string }) => al.title), ["Trip"], "a trip counts on its middle days; a monthly album doesn't");
    assert.deepEqual(memories[1].records.map((r: { title: string }) => r.title), ["Old cafe"]);
  });

  test("nothing on other days, and never this year's visits", async () => {
    assert.deepEqual(await a.ok("GET", "/memories?date=2026-10-07&tz=Asia/Seoul"), []);
    assert.deepEqual(await a.ok("GET", "/memories?date=2025-10-04&tz=Asia/Seoul").then((m) => m.map((x: { year: number }) => x.year)), [2024]);
    assert.equal((await a.request("GET", "/memories?date=2026-10-04&tz=Mars/Olympus")).status, 400);
  });
});

describe("yearly recap", () => {
  test("counts the viewer's calendar year", async () => {
    const recap = await a.ok("GET", "/recap?year=2025&tz=Asia/Seoul");
    assert.deepEqual(recap.totals, { visits: 3, days: 2, places: 3, newPlaces: 2, albums: 2, photos: 0, videos: 0 });
    assert.equal(recap.months[9], 2);
    assert.equal(recap.months[11], 1);
    assert.deepEqual(recap.categories.map((c: { category: string; count: number }) => `${c.category}:${c.count}`).sort(), [
      "CAFE:1",
      "DESSERT:1",
      "TOUR:1",
    ]);
    assert.deepEqual(recap.areas.map((x: { name: string }) => x.name).sort(), ["서울 마포구", "東京都 港区"].sort());
    assert.deepEqual(recap.topRated.map((p: { name: string; rating: number }) => [p.name, p.rating]), [
      ["Old cafe", 4],
      ["Dawn bakery", 3],
    ]);
    assert.ok(recap.years.includes(2024) && recap.years[0] >= 2026);
  });

  test("the same instant lands in another year for another time zone", async () => {
    const seoul = await a.ok("GET", "/recap?year=2026&tz=Asia/Seoul");
    const utc = await a.ok("GET", "/recap?year=2026&tz=UTC");
    assert.equal(seoul.totals.visits, 1);
    assert.equal(utc.totals.visits, 0);
  });
});

describe("helpers", () => {
  test("areaOf reads Korean and Japanese addresses", () => {
    assert.equal(areaOf("대한민국 서울특별시 마포구 양화로 1"), "서울 마포구");
    assert.equal(areaOf("경기도 성남시 분당구 판교역로 1"), "경기도 성남시");
    assert.equal(areaOf("제주특별자치도 제주시 첨단로 1"), "제주 제주시");
    assert.equal(areaOf("日本、〒600-8216 京都府京都市下京区東塩小路町"), "京都府 京都市");
    assert.equal(areaOf("〒060-0806 北海道札幌市北区北６条西４丁目"), "北海道 札幌市");
    assert.equal(areaOf("1600 Amphitheatre Pkwy, Mountain View"), null);
    assert.equal(areaOf(null), null);
  });

  test("localParts follows the time zone", () => {
    const instant = new Date("2026-01-01T00:30:00+09:00");
    assert.deepEqual(localParts(instant, "Asia/Seoul"), { date: "2026-01-01", hour: 0 });
    assert.deepEqual(localParts(instant, "UTC"), { date: "2025-12-31", hour: 15 });
  });

  test("milestones: every 100th day (the anniversary is day 1) and each year", () => {
    assert.deepEqual(milestonesOn("2024-05-01", "2024-08-08"), [{ kind: "days", count: 100 }]);
    assert.deepEqual(milestonesOn("2024-05-01", "2025-05-01"), [{ kind: "years", count: 1 }]);
    assert.deepEqual(milestonesOn("2024-05-01", "2024-05-01"), []);
    assert.deepEqual(milestonesOn("2024-05-01", "2024-08-09"), []);
  });

  test("the morning digest covers milestones, plans and memories", () => {
    const messages = buildDigest(
      {
        today: "2024-08-07",
        anniversaryDate: "2024-05-01",
        plans: [
          { title: "Dinner", date: "2024-08-07" },
          { title: "Movie", date: "2024-08-08" },
          { title: "Later", date: "2024-08-20" },
        ],
        visits: [
          { title: "Beach", date: "2023-08-07" },
          { title: "Elsewhere", date: "2023-08-08" },
        ],
      },
      "ko",
    );
    assert.deepEqual(messages.map((m) => [m.title, m.body]), [
      ["내일은 100일이에요", "특별한 하루를 준비해 보세요"],
      ["오늘의 데이트", "Dinner"],
      ["내일의 데이트", "Movie"],
      ["1년 전 오늘", "Beach"],
    ]);
    assert.deepEqual(buildDigest({ today: "2024-06-01", anniversaryDate: "2024-05-01", plans: [], visits: [] }, "ja"), []);
  });
});

test("storage, export and push answer sensibly without R2 or push keys", async () => {
  const storage = await a.ok("GET", "/couple/storage");
  assert.deepEqual(storage, { usedBytes: 0, freeBytes: 10_000_000_000, photos: { count: 0, bytes: 0 }, videos: { count: 0, bytes: 0 }, pending: 0 });
  const exported = await a.ok("GET", "/couple/export");
  assert.equal(exported.records.length, 5);
  assert.equal(exported.albums.length, 2);
  assert.equal(exported.couple.users[0].email, "a@test.local");
  const key = await a.request("GET", "/push/key");
  assert.equal(key.status, 503);
  assert.equal(key.body.code, "PUSH_DISABLED");
});
