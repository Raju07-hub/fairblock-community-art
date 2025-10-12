const TZ_MIN = Number(process.env.RESET_TZ_MINUTES ?? 420); // default UTC+7

function nowLocal() {
  const now = new Date();
  return new Date(now.getTime() + TZ_MIN * 60000);
}
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

export function ym() {
  const n = nowLocal();
  const y = n.getUTCFullYear();
  const m = pad(n.getUTCMonth() + 1);
  return `${y}-${m}`;
}

// Weekly key dengan boundary Sabtu 00:00 UTC (≙ Sabtu 07:00 UTC+7)
export function weekSatUTC(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const utcMidnight = new Date(Date.UTC(y, m, d));
  const weekday = utcMidnight.getUTCDay();        // 0..6 => Sun..Sat
  const daysFromWeekStart = (weekday - 6 + 7) % 7; // 0 kalau Sabtu
  const weekStart = new Date(utcMidnight);
  weekStart.setUTCDate(weekStart.getUTCDate() - daysFromWeekStart);

  const yStart = new Date(Date.UTC(weekStart.getUTCFullYear(), 0, 1));
  const yStartWeekday = yStart.getUTCDay();
  const diffToSat = (yStartWeekday - 6 + 7) % 7;
  const firstWeekStart = new Date(yStart);
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - diffToSat);

  const weekNo = Math.floor((+weekStart - +firstWeekStart) / 86400000 / 7) + 1;
  const yearOfWeek = weekStart.getUTCFullYear();

  return `${yearOfWeek}-W${pad(weekNo)}`;
}
