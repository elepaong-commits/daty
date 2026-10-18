// All calendar math happens in the viewer's local time zone.

const DAY_MS = 24 * 60 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, '0')

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
export const addMonths = (d: Date, months: number) => new Date(d.getFullYear(), d.getMonth() + months, 1)

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Whole calendar days from `from` to `to` (local dates, DST-safe). */
export const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS)

/** `YYYY-MM-DD` → local midnight (not UTC, which `new Date(str)` would give). */
export const parseDateOnly = (value: string) => {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const fromInputs = (date: string, time: string) => {
  const [h, min] = time.split(':').map(Number)
  const d = parseDateOnly(date)
  d.setHours(h ?? 0, min ?? 0)
  return d
}

export const formatMonthDay = (d: Date) => `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
export const formatSlashDay = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
export const formatDotted = (d: Date) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`

/** `MM/DD`, or `MM/DD–MM/DD` for a span of days. */
export const formatSlashRange = (start: Date, end: Date) =>
  isSameDay(start, end) ? formatSlashDay(start) : `${formatSlashDay(start)}–${formatSlashDay(end)}`

/** `YYYY.MM.DD`, or `YYYY.MM.DD–MM.DD` for a span (the end keeps its year when it's in another one). */
export const formatDottedRange = (start: Date, end: Date) => {
  if (isSameDay(start, end)) return formatDotted(start)
  const sameYear = start.getFullYear() === end.getFullYear()
  return `${formatDotted(start)}–${sameYear ? formatMonthDay(end) : formatDotted(end)}`
}

/** `M/D · title` (or `M/D–M/D · title`); a monthly album shows its month instead, e.g. `2026년 10월 · title`. */
export const albumHeading = (
  { title, albumDate, albumEndDate, monthly }: { title: string; albumDate: string; albumEndDate: string; monthly: boolean },
  formatYearMonth: (d: Date) => string,
) => `${monthly ? formatYearMonth(parseDateOnly(albumDate)) : formatSlashRange(parseDateOnly(albumDate), parseDateOnly(albumEndDate))} · ${title}`

/** Whether two `YYYY-MM-DD` ranges share a day (the strings sort like the dates). */
export const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart <= bEnd && bStart <= aEnd

/** Korean couple count: the anniversary itself is day 1. */
export const daysTogether = (anniversary: string, today = new Date()) =>
  daysBetween(parseDateOnly(anniversary), today) + 1

/** 6-week grid starting on Sunday that covers the month of `month`. */
export function monthGrid(month: Date) {
  const first = startOfMonth(month)
  const start = addDays(first, -first.getDay())
  const weeks: Date[][] = []
  for (let w = 0; w < 6; w++) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)))
  }
  // Drop a trailing week that belongs entirely to the next month.
  return weeks.filter((week) => week.some((d) => d.getMonth() === first.getMonth()))
}

/** Video length as `m:ss` (or `h:mm:ss`). */
export function formatDuration(totalSec: number) {
  const s = Math.round(totalSec)
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
