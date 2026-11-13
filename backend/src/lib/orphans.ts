import { prisma } from "./prisma.js";
import { deleteObjects, listObjects, storageEnabled, type StoredObject } from "./storage.js";

// Files go to R2 before the API records them (POST /api/albums/:id/photos). An upload whose confirm never
// arrives (tab closed, network gone) leaves a file nothing points to. Once a day such files are deleted.

// Upload URLs last 10 minutes and the confirm follows right after; a day is far past any upload in flight.
const GRACE_MS = 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 24 * 60 * 60 * 1000;
// Not right at startup, so a deploy's restart isn't also the moment the bucket gets listed.
const FIRST_SWEEP_AFTER_MS = 10 * 60 * 1000;

/** The keys on one page of the listing that no photo, thumbnail or old stored URL refers to. */
async function unreferenced(objects: StoredObject[], now: number) {
  const old = objects.filter((o) => now - o.lastModified.getTime() > GRACE_MS).map((o) => o.key);
  if (old.length === 0) return [];
  const [photos, legacy] = await Promise.all([
    prisma.photo.findMany({
      where: { OR: [{ storageKey: { in: old } }, { thumbnailKey: { in: old } }] },
      select: { storageKey: true, thumbnailKey: true },
    }),
    // Rows from before storage keys keep a full URL; never delete a file one of those may point at.
    prisma.photo.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
  ]);
  const used = new Set(photos.flatMap((p) => [p.storageKey, p.thumbnailKey]));
  return old.filter((key) => !used.has(key) && !legacy.some((p) => p.imageUrl!.includes(key)));
}

/** Deletes uploaded files nothing refers to. Returns how many went. The listing is injectable for tests. */
export async function sweepOrphanUploads({
  pages = listObjects("couples/"),
  remove = deleteObjects,
  now = Date.now(),
}: { pages?: AsyncIterable<StoredObject[]>; remove?: (keys: string[]) => Promise<void>; now?: number } = {}) {
  let removed = 0;
  for await (const page of pages) {
    const orphans = await unreferenced(page, now);
    if (orphans.length > 0) await remove(orphans);
    removed += orphans.length;
  }
  return removed;
}

/** Runs the sweep once a day inside the API process; nothing to do without R2. */
export function startOrphanSweep() {
  if (!storageEnabled) return;
  const run = () =>
    sweepOrphanUploads()
      .then((n) => n > 0 && console.log(`Deleted ${n} uploaded files no photo refers to`))
      .catch((err: unknown) => console.error("Sweeping unrecorded uploads failed:", err));
  setTimeout(() => {
    run();
    setInterval(run, SWEEP_EVERY_MS).unref();
  }, FIRST_SWEEP_AFTER_MS).unref();
}
