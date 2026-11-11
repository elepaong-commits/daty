import { Router } from "express";
import { z } from "zod";
import { areaOf } from "../lib/area.js";
import { memoriesOn } from "../lib/digest.js";
import { toDateOnly } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { serializePhoto } from "../lib/storage.js";
import { localParts, timeZoneParam } from "../lib/time.js";

// Looking back: "N years ago today" and the yearly recap. Both read the couple's visits (RECORD entries)
// by the calendar day they fell on in the viewer's time zone.

export const memoriesRouter = Router();
export const recapRouter = Router();

const DAY_MS = 86_400_000;

const memoriesQuery = z.object({ date: z.iso.date(), tz: timeZoneParam });

memoriesRouter.get("/", async (req, res) => {
  const { date, tz } = memoriesQuery.parse(req.query);
  const { coupleId } = req;
  const year = Number(date.slice(0, 4));
  const [records, albums] = await Promise.all([
    prisma.dateRecord.findMany({
      where: { coupleId, type: "RECORD", scheduledAt: { lt: new Date(`${year}-01-01T00:00:00Z`) } },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        title: true,
        category: true,
        rating: true,
        memo: true,
        scheduledAt: true,
        place: { select: { id: true, name: true } },
      },
    }),
    // A trip counts on each of its days; a monthly album isn't about any one day.
    prisma.album.findMany({
      where: { coupleId, monthly: false, albumDate: { lt: new Date(`${year}-01-01`) } },
      include: { photos: { orderBy: { displayOrder: "asc" } } },
    }),
  ]);
  const visits = memoriesOn(date, records.map((r) => ({ ...r, date: localParts(r.scheduledAt, tz).date })));
  const albumsByYear = new Map<number, typeof albums>();
  for (const album of albums) {
    const [start, end] = [toDateOnly(album.albumDate), toDateOnly(album.albumEndDate ?? album.albumDate)];
    for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)) && y < year; y++) {
      const day = `${y}${date.slice(4)}`;
      if (day >= start && day <= end) albumsByYear.set(y, [...(albumsByYear.get(y) ?? []), album]);
    }
  }
  const years = [...new Set([...visits.map((v) => year - v.yearsAgo), ...albumsByYear.keys()])].sort((a, b) => b - a);
  res.json(
    await Promise.all(
      years.map(async (y) => ({
        year: y,
        yearsAgo: year - y,
        records: (visits.find((v) => v.yearsAgo === year - y)?.items ?? []).map(({ date: _date, ...record }) => record),
        albums: await Promise.all(
          (albumsByYear.get(y) ?? []).map(async ({ photos, ...album }) => {
            const cover = photos.find((p) => p.id === album.coverPhotoId) ?? photos[0];
            return {
              id: album.id,
              title: album.title,
              albumDate: toDateOnly(album.albumDate),
              albumEndDate: toDateOnly(album.albumEndDate ?? album.albumDate),
              photoCount: photos.length,
              coverPhoto: cover ? await serializePhoto(cover) : null,
            };
          }),
        ),
      })),
    ),
  );
});

const recapQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100), tz: timeZoneParam });
const TOP = 5;

recapRouter.get("/", async (req, res) => {
  const { year, tz } = recapQuery.parse(req.query);
  const { coupleId } = req;
  // A day wider on both sides than the UTC year, then narrowed to the viewer's calendar year.
  const from = new Date(Date.UTC(year, 0, 1) - DAY_MS);
  const to = new Date(Date.UTC(year + 1, 0, 1) + DAY_MS);
  const [nearby, firstVisits, mediaCounts, albumCount, oldest] = await Promise.all([
    prisma.dateRecord.findMany({
      where: { coupleId, type: "RECORD", scheduledAt: { gte: from, lt: to } },
      select: {
        category: true,
        rating: true,
        scheduledAt: true,
        place: { select: { id: true, name: true, address: true, category: true } },
      },
    }),
    prisma.dateRecord.groupBy({
      by: ["placeId"],
      where: { coupleId, type: "RECORD", placeId: { not: null } },
      _min: { scheduledAt: true },
    }),
    prisma.photo.groupBy({
      by: ["mediaType"],
      where: { album: { coupleId, albumDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } },
      _count: true,
    }),
    prisma.album.count({ where: { coupleId, albumDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } }),
    prisma.dateRecord.findFirst({ where: { coupleId, type: "RECORD" }, orderBy: { scheduledAt: "asc" }, select: { scheduledAt: true } }),
  ]);
  const visits = nearby
    .map((r) => ({ ...r, date: localParts(r.scheduledAt, tz).date }))
    .filter((r) => r.date.startsWith(`${year}-`));

  const months = Array.from({ length: 12 }, () => 0);
  const categories = new Map<string, number>();
  const areas = new Map<string, number>();
  const places = new Map<number, { placeId: number; name: string; category: string; visits: number; ratings: number[] }>();
  for (const visit of visits) {
    months[Number(visit.date.slice(5, 7)) - 1]!++;
    categories.set(visit.category, (categories.get(visit.category) ?? 0) + 1);
    if (!visit.place) continue;
    const area = areaOf(visit.place.address);
    if (area) areas.set(area, (areas.get(area) ?? 0) + 1);
    const place = places.get(visit.place.id) ?? {
      placeId: visit.place.id,
      name: visit.place.name,
      category: visit.place.category,
      visits: 0,
      ratings: [],
    };
    place.visits++;
    if (visit.rating !== null) place.ratings.push(visit.rating);
    places.set(visit.place.id, place);
  }
  const ranked = (counts: Map<string, number>) =>
    [...counts].sort(([, a], [, b]) => b - a).map(([name, count]) => ({ name, count }));
  const visited = [...places.values()].map(({ ratings, ...place }) => ({
    ...place,
    rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
  }));
  const newPlaces = firstVisits.filter((f) => f._min.scheduledAt && localParts(f._min.scheduledAt, tz).date.startsWith(`${year}-`)).length;
  const media = (type: "PHOTO" | "VIDEO") => mediaCounts.find((m) => m.mediaType === type)?._count ?? 0;
  const thisYear = Number(localParts(new Date(), tz).date.slice(0, 4));
  const firstYear = oldest ? Number(localParts(oldest.scheduledAt, tz).date.slice(0, 4)) : thisYear;

  res.json({
    year,
    // Years worth offering in the year switcher, newest first.
    years: Array.from({ length: Math.max(thisYear - firstYear, 0) + 1 }, (_, i) => thisYear - i),
    totals: {
      visits: visits.length,
      days: new Set(visits.map((v) => v.date)).size,
      places: places.size,
      newPlaces,
      albums: albumCount,
      photos: media("PHOTO"),
      videos: media("VIDEO"),
    },
    months,
    categories: ranked(categories).map(({ name, count }) => ({ category: name, count })),
    areas: ranked(areas).slice(0, TOP),
    mostVisited: [...visited].sort((a, b) => b.visits - a.visits).slice(0, TOP),
    topRated: visited
      .filter((p) => p.rating !== null)
      .sort((a, b) => b.rating! - a.rating! || b.visits - a.visits)
      .slice(0, TOP),
  });
});
