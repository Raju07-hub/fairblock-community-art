// lib/period.ts
// Time helpers with default UTC+7 local offset for daily/monthly boundaries.
// Weekly boundary uses Saturday 00:00 UTC (== Saturday 07:00 UTC+7).

const TZ_MIN = Number(process.env.RESET_TZ_MINUTES ?? 420); // default UTC+7

function nowLocal() {
  const now = new Date();
  return new Date(now.getTime() + TZ_MIN * 60000);
}
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

/** -------- Daily key (kept for compatibility / debug) -------- */
export function ymd(d?: Date) {
  const n = d ? new Date(d.getTime() + TZ_MIN * 60000) : nowLocal();
  const y = n.getUTCFullYear();
  const m = pad(n.getUTCMonth() + 1);
  const dd = pad(n.getUTCDate());
  return `${y}-${m}-${dd}`;
}

/** -------- ISO week (Mon-based) – kept for compatibility/debug -------- */
export function isoWeek(d?: Date) {
  const n = d ? new Date(d.getTime() + TZ_MIN * 60000) : nowLocal();
  const date = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // 0..6 = Mon..Sun
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (date.getTime() - firstThu.getTime()) / 86400000;
  const week = 1 + Math.floor(diff / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

/** -------- Monthly key (UTC+7 boundary by default) -------- */
export function ym(d?: Date) {
  const n = d ? new Date(d.getTime() + TZ_MIN * 60000) : nowLocal();
  const y = n.getUTCFullYear();
  const m = pad(n.getUTCMonth() + 1);
  return `${y}-${m}`;
}

/** -------- Weekly key with boundary: Saturday 00:00 UTC --------
 * Week starts at Saturday 00:00 UTC (== Saturday 07:00 in UTC+7).
 * Returns "YYYY-WNN".
 */
export function weekSatUTC(date = new Date()) {
  // midnight UTC of given date
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = base.getUTCDay(); // 0=Sun..6=Sat
  // Distance from Saturday (6)
  const daysFromWeekStart = (weekday - 6 + 7) % 7; // 0 if Saturday
  const weekStart = new Date(base);
  weekStart.setUTCDate(weekStart.getUTCDate() - daysFromWeekStart);

  // First week start of the year = the Saturday on/before Jan 1
  const yearStart = new Date(Date.UTC(weekStart.getUTCFullYear(), 0, 1));
  const yStartWd = yearStart.getUTCDay();
  const diffToSat = (yStartWd - 6 + 7) % 7;
  const firstWeekStart = new Date(yearStart);
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - diffToSat);

  const weekNo = Math.floor((+weekStart - +firstWeekStart) / 86400000 / 7) + 1;
  const yearOfWeek = weekStart.getUTCFullYear();
  return `${yearOfWeek}-W${pad(weekNo)}`;
}
