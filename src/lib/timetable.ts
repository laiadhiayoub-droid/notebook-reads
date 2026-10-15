export const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"] as const;

export const PERIODS = [
  { n: 1, time: "08:00-09:00" },
  { n: 2, time: "09:00-10:00" },
  { n: 3, time: "10:00-11:00" },
  { n: 4, time: "11:00-12:00" },
  { n: 5, time: "13:00-14:00" },
  { n: 6, time: "14:00-15:00" },
  { n: 7, time: "15:00-16:00" },
] as const;

export const FREE = "فراغ";

export const SCHEDULE: Record<(typeof DAYS)[number], string[]> = {
  الأحد: ["شريعة", "لغة عربية", "رياضة", "رياضة", "اجتماعيات", "إنجليزية", FREE],
  الاثنين: ["لغة عربية", "لغة عربية", "إنجليزية", "شريعة", "إسبانية", "إسبانية", "فرنسية"],
  الثلاثاء: [FREE, "إنجليزية", "اجتماعيات", "رياضيات", "إسبانية", "فرنسية", "لغة عربية"],
  الأربعاء: ["إنجليزية", "إنجليزية", "فرنسية", "فرنسية", "رياضيات", "اجتماعيات", FREE],
  الخميس: ["إسبانية", "إسبانية", "فرنسية", FREE, "لغة عربية", "اجتماعيات", FREE],
};

/** Groups consecutive identical subjects (never across lunch, between period 4 and 5) into merged blocks. */
export function mergeRow(row: string[]) {
  const out: { subject: string; start: number; span: number }[] = [];
  row.forEach((subject, i) => {
    const last = out[out.length - 1];
    if (last && last.subject === subject && subject !== FREE && i !== 4) last.span++;
    else out.push({ subject, start: i, span: 1 });
  });
  return out;
}

/** Current weekday (0=Sun) and minutes since midnight in Algeria time. */
export function algiersNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Algiers", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const CUTOFF = 17 * 60 + 5;

/**
 * Which day to show: today before 17:05 on a school day, otherwise the next
 * school day (Fri/Sat and Thursday evening roll forward to Sunday).
 */
export function pickDay(weekday: number, minutes: number) {
  const schoolDay = weekday >= 0 && weekday <= 4;
  if (schoolDay && minutes < CUTOFF) return { dayIndex: weekday, mode: "today" as const };
  let next = (weekday + 1) % 7;
  while (next > 4) next = (next + 1) % 7;
  return { dayIndex: next, mode: next === (weekday + 1) % 7 ? ("tomorrow" as const) : ("next" as const) };
}
