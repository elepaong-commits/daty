import assert from "node:assert/strict";
import { test } from "node:test";
import { imageSigningTime } from "../src/lib/storage.js";

// Photo URLs stay the same for days, turning over in the small hours in Korea and Japan.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

test("photo URLs keep one signing time for six days, turning over at 4 a.m. KST", () => {
  const start = imageSigningTime(Date.UTC(2026, 10, 13, 12));
  assert.equal(start.getUTCHours(), 19, "turns over at 19:00 UTC, 04:00 in Korea and Japan");
  assert.equal(imageSigningTime(start.getTime()).getTime(), start.getTime());
  assert.equal(imageSigningTime(start.getTime() + 6 * DAY - 1).getTime(), start.getTime());
  assert.equal(imageSigningTime(start.getTime() + 6 * DAY).getTime(), start.getTime() + 6 * DAY);
  // Never in the future, and never older than the window (so a 7-day signature has a day to spare).
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2026, 0, 20); t += 5 * HOUR) {
    const signed = imageSigningTime(t).getTime();
    assert.ok(signed <= t && t - signed < 6 * DAY);
  }
});
