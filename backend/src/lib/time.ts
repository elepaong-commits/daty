import { z } from "zod";

// Calendar days depend on where the viewer is, so clients send their IANA time zone and the server
// works out local dates from it.

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isTimeZone(value: string) {
  try {
    formatterFor(value);
    return true;
  } catch {
    return false;
  }
}

export const timeZoneParam = z.string().min(1).max(64).refine(isTimeZone, "Unknown time zone");

/** The calendar day (`YYYY-MM-DD`) and hour (0–23) of an instant in a time zone. */
export function localParts(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(formatterFor(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

const DAY_MS = 86_400_000;
const utc = (dateOnly: string) => Date.parse(`${dateOnly}T00:00:00Z`);

/** `YYYY-MM-DD` moved by whole days. */
export const addDays = (dateOnly: string, days: number) => new Date(utc(dateOnly) + days * DAY_MS).toISOString().slice(0, 10);

/** Whole days from one `YYYY-MM-DD` to another. */
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY_MS);
