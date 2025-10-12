// Default UTC+7 untuk daily/monthly. Weekly pakai boundary Saturday 00:00 UTC.
const TZ_MIN = Number(process.env.RESET_TZ_MINUTES ?? 420);

function nowLocal() {
  const now = new Date();
  return new Date(now.getTime() + TZ_MIN * 60000);
}
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

/** Daily (kompat/Debug) */
export function ymd(d?: Date) {
  const n = d ? new Date(d.getTime() + TZ_MIN * 60000) : nowLocal();
  const y = n.getUTCFullYear();
  const m = pad(n.getUTCMonth() + 1);
  const dd = pad(n.getUTCDate());
  return `${y}-${m}-${dd}`;
}

/** ISO week (Mon-based) – tetap diexport agar route debug lama aman */
export function isoWeek(d?: Date) {
  const n = d ? new Date(d.getTime() + TZ_MIN * 60000) : nowLocal();
  const date = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (date.getTime() - firstThu.getTime()) / 86400000;
  const week = 1 + Math.floor(diff / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

/** Monthly (UTC+7 boundary) */
export function ym(d?: Date) {
  const n = d ? new Date(d.getTime() + TZ_MIN * 60000) : nowLocal();
  const y = n.getUTCFullYear();
  const m = pad(n.getUTCMonth() + 1);
  return `${y}-${m}`;
}

/** Weekly key dengan boundary: Saturday 00:00 UTC */
export function weekSatUTC(date = new Date()) {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = base.getUTCDay(); // 0=Sun..6=Sat
  const daysFromWeekStart = (weekday - 6 + 7) % 7; // 0 kalau Saturday
  const weekStart = new Date(base);
  weekStart.setUTCDate(weekStart.getUTCDate() - daysFromWeekStart);

  const yearStart = new Date(Date.UTC(weekStart.getUTCFullYear(), 0, 1));
  const yStartWd = yearStart.getUTCDay();
  const diffToSat = (yStartWd - 6 + 7) % 7;
  const firstWeekStart = new Date(yearStart);
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - diffToSat);

  const weekNo = Math.floor((+weekStart - +firstWeekStart) / 86400000 / 7) + 1;
  const yearOfWeek = weekStart.getUTCFullYear();
  return `${yearOfWeek}-W${pad(weekNo)}`;
}

/** Dari key week → tanggal Saturday (UTC) */
export function saturdayUTCFromWeekKey(weekKey: string): Date {
  const [yStr, wStr] = weekKey.split("-W");
  const y = Number(yStr), w = Number(wStr);
  const yearStart = new Date(Date.UTC(y, 0, 1));
  const wd = yearStart.getUTCDay();
  const diffToSat = (wd - 6 + 7) % 7;
  const firstSaturday = new Date(yearStart);
  firstSaturday.setUTCDate(firstSaturday.getUTCDate() - diffToSat);
  const weekStart = new Date(firstSaturday);
  weekStart.setUTCDate(weekStart.getUTCDate() + (w - 1) * 7);
  return weekStart; // Saturday 00:00 UTC
}

export function formatDateUTC7(dUTC: Date) {
  const t = new Date(dUTC.getTime() + TZ_MIN * 60000);
  const y = t.getUTCFullYear();
  const m = pad(t.getUTCMonth() + 1);
  const d = pad(t.getUTCDate());
  return `${y}-${m}-${d}`;
}
