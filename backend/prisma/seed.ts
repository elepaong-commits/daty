// Sample data matching the design mockups. Development databases only.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { PlaceCategory, TipType } from "../src/generated/prisma/client.js";

const url = process.env.DATABASE_URL;
const dbName = url ? new URL(url).pathname.slice(1) : "";
if (!dbName.endsWith("_dev")) {
  console.error(`Refusing to seed "${dbName}": only databases ending in _dev can be seeded.`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const COUPLE_CODE = "DEV-COUPLE";

type SeedPlace = {
  name: string;
  category: PlaceCategory;
  address: string;
  lat: number;
  lng: number;
  tip?: [TipType, string];
};

const visited: SeedPlace[] = [
  { name: "카페 소금빵공방", category: "CAFE", address: "성수동", lat: 37.5446, lng: 127.0557, tip: ["EAT", "소금빵 + 아인슈페너 조합"] },
  { name: "성수 연무장길", category: "TOUR", address: "성수동", lat: 37.543, lng: 127.056, tip: ["SEE", "골목마다 팝업스토어 구경"] },
  { name: "성수 편집숍 산책", category: "ACTIVITY", address: "성수동", lat: 37.5447, lng: 127.059 },
  { name: "북악 팔각정", category: "TOUR", address: "부암동", lat: 37.6035, lng: 126.9817, tip: ["SEE", "해 질 녘 야경이 최고"] },
  { name: "빛의 정원展", category: "EXHIBIT", address: "DDP", lat: 37.5665, lng: 127.0092, tip: ["SEE", "미디어아트 마지막 방은 꼭 끝까지"] },
  { name: "루치아 파스타", category: "FOOD", address: "연남동", lat: 37.5637, lng: 126.9246, tip: ["EAT", "트러플 크림 파스타"] },
];

const wished: SeedPlace[] = [
  { name: "망원 디저트바 몽", category: "CAFE", address: "망원동", lat: 37.556, lng: 126.903 },
  { name: "북촌 한옥 산책", category: "TOUR", address: "북촌", lat: 37.5826, lng: 126.983 },
  { name: "연남 화덕피자", category: "FOOD", address: "연남동", lat: 37.562, lng: 126.925 },
  { name: "리움미술관", category: "EXHIBIT", address: "한남동", lat: 37.5384, lng: 126.999 },
  { name: "서울숲 피크닉", category: "ACTIVITY", address: "성수동", lat: 37.5444, lng: 127.0374 },
  { name: "을지로 노가리 골목", category: "BAR", address: "을지로", lat: 37.566, lng: 126.991 },
];

// [place name, KST datetime, memo, rating]
const records: [string, string, string, number][] = [
  ["빛의 정원展", "2026-09-27T14:00", "몰입형 전시라 사진이 잘 나옴", 5],
  ["루치아 파스타", "2026-09-27T18:30", "웨이팅 30분, 그래도 또 올 곳", 5],
  ["북악 팔각정", "2026-10-03T17:00", "개천절 드라이브, 노을 타이밍 완벽", 5],
  ["성수 연무장길", "2026-10-04T12:00", "팝업 세 군데 구경", 4],
  ["카페 소금빵공방", "2026-10-04T14:30", "2층 창가 자리 추천", 5],
  ["성수 편집숍 산책", "2026-10-04T16:00", "커플 키링 득템", 4],
];

const plans: [string, string, string][] = [
  ["망원 디저트바 몽", "2026-10-08T19:30", "퇴근 후 바로! 몽블랑은 하루 20개 한정"],
  ["북촌 한옥 산책", "2026-10-10T11:00", "한복 대여 예약하기"],
  ["연남 화덕피자", "2026-10-10T18:00", "마르게리타 + 하우스 와인"],
  ["리움미술관", "2026-10-17T13:00", "온라인 사전 예약 필수"],
  ["서울숲 피크닉", "2026-10-24T12:00", "돗자리랑 샌드위치 챙기기"],
  ["을지로 노가리 골목", "2026-10-31T19:00", "핼러윈엔 노가리"],
];

const albums: { title: string; date: string; note: string | null; places: string[] }[] = [
  { title: "성수동 카페 데이트", date: "2026-10-04", note: "2층 창가에서 찍은 노을 사진이 베스트 컷", places: ["성수 연무장길", "카페 소금빵공방", "성수 편집숍 산책"] },
  { title: "개천절 북악 드라이브", date: "2026-10-03", note: null, places: ["북악 팔각정"] },
  { title: "빛의 정원展 관람", date: "2026-09-27", note: "마지막 방 미디어아트", places: ["빛의 정원展", "루치아 파스타"] },
];

const kst = (local: string) => new Date(`${local}:00+09:00`);

async function main() {
  // Keep the couple row (so DEV_COUPLE_ID stays stable) and rebuild everything under it.
  const anniversaryDate = new Date("2025-08-23");
  const { id: coupleId } = await prisma.couple.upsert({
    where: { coupleCode: COUPLE_CODE },
    create: { coupleCode: COUPLE_CODE, anniversaryDate },
    update: { anniversaryDate },
  });
  await prisma.album.deleteMany({ where: { coupleId } });
  await prisma.dateRecord.deleteMany({ where: { coupleId } });
  await prisma.place.deleteMany({ where: { coupleId } });
  await prisma.user.deleteMany({ where: { coupleId } });

  const couple = await prisma.couple.update({
    where: { id: coupleId },
    data: {
      users: {
        create: [
          { email: "dev-a@daty.local", passwordHash: "!", nickname: "토끼" },
          { email: "dev-b@daty.local", passwordHash: "!", nickname: "곰돌이" },
        ],
      },
    },
    include: { users: true },
  });
  const writerIds = couple.users.map((u) => u.id);

  const placeIds = new Map<string, { id: number; category: PlaceCategory }>();
  for (const [status, list] of [["VISITED", visited], ["WISH", wished]] as const) {
    for (const p of list) {
      const place = await prisma.place.create({
        data: {
          coupleId: couple.id,
          name: p.name,
          category: p.category,
          status,
          address: p.address,
          latitude: p.lat,
          longitude: p.lng,
          tipType: p.tip?.[0],
          tipText: p.tip?.[1],
        },
      });
      placeIds.set(p.name, { id: place.id, category: p.category });
    }
  }

  const recordIds = new Map<string, number>();
  const entries = [
    ...records.map(([name, at, memo, rating]) => ({ name, at, memo, rating, type: "RECORD" as const })),
    ...plans.map(([name, at, memo]) => ({ name, at, memo, rating: undefined, type: "PLAN" as const })),
  ];
  for (const [i, e] of entries.entries()) {
    const place = placeIds.get(e.name)!;
    const record = await prisma.dateRecord.create({
      data: {
        coupleId: couple.id,
        placeId: place.id,
        writerId: writerIds[i % writerIds.length],
        type: e.type,
        title: e.name,
        memo: e.memo,
        category: place.category,
        rating: e.rating,
        scheduledAt: kst(e.at),
      },
    });
    recordIds.set(e.name, record.id);
  }

  for (const a of albums) {
    await prisma.album.create({
      data: {
        coupleId: couple.id,
        title: a.title,
        albumDate: new Date(a.date),
        highlightNote: a.note,
        records: { connect: a.places.map((name) => ({ id: recordIds.get(name)! })) },
      },
    });
  }

  console.log(`Seeded couple ${COUPLE_CODE} (id=${couple.id}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
