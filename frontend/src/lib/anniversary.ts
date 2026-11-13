import { daysBetween, parseDateOnly } from './dates'

// The days a couple celebrates, counted as in Korea: the anniversary itself is day 1, then every 100th
// day and each year. The same rule the morning notification uses (backend src/lib/digest.ts).

export type Milestone = { kind: 'days'; count: number } | { kind: 'years'; count: number }

/** What `date` (YYYY-MM-DD) celebrates for a couple together since `anniversaryDate`. */
export function milestonesOn(anniversaryDate: string, date: string): Milestone[] {
  const day = daysBetween(parseDateOnly(anniversaryDate), parseDateOnly(date)) + 1
  const years = Number(date.slice(0, 4)) - Number(anniversaryDate.slice(0, 4))
  return [
    ...(day > 1 && day % 100 === 0 ? [{ kind: 'days' as const, count: day }] : []),
    ...(years >= 1 && date.slice(5) === anniversaryDate.slice(5) ? [{ kind: 'years' as const, count: years }] : []),
  ]
}
