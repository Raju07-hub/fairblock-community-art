// lib/period.ts
const TZ_MIN = Number(process.env.RESET_TZ_MINUTES ?? 420); // default UTC+7

function nowLocal() {
  const now = new Date();
  return new Date(now.getTime() + TZ_MIN * 60000);
}
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

export function ymd() {
  const n = nowLocal();
  const y = n.getUTCFullYear();
  const m = pad(n.getUTCMonth() + 1);
  const d = pad(n.getUTCDate());
  return `${y}-${m}-${d}`;
}

export function isoWeek() {
  const n = nowLocal();
  const date = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (date.getTime() - firstThu.getTime()) / 86400000;
  const week = 1 + Math.floor(diff / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

export function prevYmd(s: string) {
  const [y,m,d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m-1, d-1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`;
}

export function prevIsoWeek(w: string) {
  const [y, wstr] = w.split("-W");
  const num = Math.max(1, Number(wstr) - 1);
  return `${y}-W${pad(num)}`;
}
