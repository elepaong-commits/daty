import type { Locale, PushMessage } from "./push.js";
import { addDays, daysBetween } from "./time.js";

// The morning notification: anniversaries coming up, today's and tomorrow's plans, and "N years ago today".

export interface DigestInput {
  /** The device's calendar day, `YYYY-MM-DD`. */
  today: string;
  anniversaryDate: string;
  /** Plans with the local day they fall on. */
  plans: { title: string; date: string }[];
  /** Past visits with the local day they happened on. */
  visits: { title: string; date: string }[];
}

type Milestone = { kind: "days"; count: number } | { kind: "years"; count: number };

/** What the couple celebrates on `date`: every 100th day (the anniversary itself is day 1) and each year. */
export function milestonesOn(anniversaryDate: string, date: string): Milestone[] {
  const day = daysBetween(anniversaryDate, date) + 1;
  const years = Number(date.slice(0, 4)) - Number(anniversaryDate.slice(0, 4));
  return [
    ...(day > 1 && day % 100 === 0 ? [{ kind: "days" as const, count: day }] : []),
    ...(years >= 1 && date.slice(5) === anniversaryDate.slice(5) ? [{ kind: "years" as const, count: years }] : []),
  ];
}

/** Visits on this month and day in earlier years, grouped by how long ago. */
export function memoriesOn<T extends { date: string }>(today: string, visits: T[]) {
  const groups = new Map<number, T[]>();
  for (const visit of visits) {
    const yearsAgo = Number(today.slice(0, 4)) - Number(visit.date.slice(0, 4));
    if (yearsAgo < 1 || visit.date.slice(5) !== today.slice(5)) continue;
    groups.set(yearsAgo, [...(groups.get(yearsAgo) ?? []), visit]);
  }
  return [...groups].sort(([a], [b]) => a - b).map(([yearsAgo, items]) => ({ yearsAgo, items }));
}

const text = {
  ko: {
    milestone: (m: Milestone) => (m.kind === "days" ? `${m.count}일` : `${m.count}주년`),
    milestoneToday: (name: string) => ({ title: `오늘은 ${name} 🎉`, body: "함께한 날들을 축하해요" }),
    milestoneSoon: (name: string, days: number) => ({
      title: days === 1 ? `내일은 ${name}이에요` : `${name}까지 ${days}일 남았어요`,
      body: "특별한 하루를 준비해 보세요",
    }),
    plansToday: "오늘의 데이트",
    plansTomorrow: "내일의 데이트",
    memory: (years: number) => `${years}년 전 오늘`,
    list: (titles: string[]) => titles.join(", "),
  },
  ja: {
    milestone: (m: Milestone) => (m.kind === "days" ? `${m.count}日` : `${m.count}周年`),
    milestoneToday: (name: string) => ({ title: `今日は${name} 🎉`, body: "一緒に過ごした日々をお祝いしましょう" }),
    milestoneSoon: (name: string, days: number) => ({
      title: days === 1 ? `明日は${name}です` : `${name}まであと${days}日`,
      body: "特別な一日を準備しましょう",
    }),
    plansToday: "今日のデート",
    plansTomorrow: "明日のデート",
    memory: (years: number) => `${years}年前の今日`,
    list: (titles: string[]) => titles.join("、"),
  },
} satisfies Record<Locale, unknown>;

const SOON = [1, 7];

export function buildDigest({ today, anniversaryDate, plans, visits }: DigestInput, locale: Locale): PushMessage[] {
  const t = text[locale];
  const messages: PushMessage[] = [];

  for (const milestone of milestonesOn(anniversaryDate, today)) {
    messages.push({ ...t.milestoneToday(t.milestone(milestone)), url: "/calendar", tag: "anniversary" });
  }
  for (const days of SOON) {
    for (const milestone of milestonesOn(anniversaryDate, addDays(today, days))) {
      messages.push({ ...t.milestoneSoon(t.milestone(milestone), days), url: "/calendar", tag: "anniversary-soon" });
    }
  }

  const titlesOn = (date: string) => plans.filter((p) => p.date === date).map((p) => p.title);
  const todays = titlesOn(today);
  const tomorrows = titlesOn(addDays(today, 1));
  if (todays.length > 0) messages.push({ title: t.plansToday, body: t.list(todays), url: "/calendar", tag: "plans-today" });
  if (tomorrows.length > 0) messages.push({ title: t.plansTomorrow, body: t.list(tomorrows), url: "/calendar", tag: "plans-tomorrow" });

  for (const { yearsAgo, items } of memoriesOn(today, visits)) {
    messages.push({ title: t.memory(yearsAgo), body: t.list(items.map((v) => v.title)), url: "/albums", tag: `memory-${yearsAgo}` });
  }
  return messages;
}
