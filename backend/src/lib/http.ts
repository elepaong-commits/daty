import { z } from "zod";

export const idParam = z.object({ id: z.coerce.number().int().positive() });

/** `2026-10-04T00:00:00.000Z` → `2026-10-04` for `@db.Date` columns. */
export function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
