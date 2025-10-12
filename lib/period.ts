// lib/period.ts
// ==== BASE OFFSET (dipakai util lama) ====
const TZ_MIN = Number(process.env.RESET_TZ_MINUTES ?? 420); // default UTC+7

function nowLocal() {
  const now = new Date();
  return new Date(now.getTime() + TZ_MIN * 60000);
}
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

// ==== HARIAN (EXISTING) ====
export function ymd() {
  const n = nowLocal();
  const y = n.getUTCFullYear();
  const m = pad(n.getUTCMonth() + 1);
  const d = pad(n.getUTCDate());
  return `${y}-${m}-${d}`;
}

// ==== ISO WEEK (EXISTING) =====
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

// ==== BULANAN (untuk leaderboard monthly) ====
export function ym() {
  const n = nowLocal(); // reset bulanan tetap mengikuti TZ_MIN (UTC+7 → jam 07:00)
  const y = n.getUTCFullYear();
  const m = pad(n.getUTCMonth() + 1);
  return `${y}-${m}`; // ex: 2025-10
}
export function prevYm(s?: string) {
  let y: number, m: number;
  if (s) {
    const [yy, mm] = s.split("-").map(Number);
    y = yy; m = mm - 1;
  } else {
    const n = nowLocal();
    y = n.getUTCFullYear(); m = n.getUTCMonth();
  }
  const d = new Date(Date.UTC(y, m - 1, 1));
  const yy = d.getUTCFullYear();
  const mm = pad(d.getUTCMonth() + 1);
  return `${yy}-${mm}`;
}

// ==== MINGGUAN DENGAN BATAS SABTU 00:00 UTC ====
// Kunci mingguan berbasis UTC: tiap minggu dimulai Sabtu 00:00 UTC
export function weekSatUTC(date = new Date()) {
  // Ambil tanggal UTC (tanpa offset lokal)
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const utcMidnight = new Date(Date.UTC(y, m, d)); // 00:00 UTC

  const weekday = utcMidnight.getUTCDay(); // 0=Sun..6=Sat
  // Kita ingin "awal minggu" = Sabtu 00:00 UTC.
  // Hitung jarak ke Sabtu (6).
  const daysFromWeekStart = (weekday - 6 + 7) % 7; // 0 kalau Sabtu
  const weekStart = new Date(utcMidnight);
  weekStart.setUTCDate(weekStart.getUTCDate() - daysFromWeekStart);

  // Minggu pertama tahun: yang berisi Sabtu pertama tahun itu.
  const yStart = new Date(Date.UTC(weekStart.getUTCFullYear(), 0, 1));
  const yStartWeekday = yStart.getUTCDay();
  const daysFromWeekStartYear = (yStartWeekday - 6 + 7) % 7;
  const firstWeekStart = new Date(yStart);
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - daysFromWeekStartYear);

  const weekNo = Math.floor((+weekStart - +firstWeekStart) / 86400000 / 7) + 1;
  const yearOfWeek = weekStart.getUTCFullYear();

  return `${yearOfWeek}-W${pad(weekNo)}`; // contoh: 2025-W41
}

// (opsional) next reset stamp Sabtu 00:00 UTC
export function nextWeeklyResetUTC(from = new Date()) {
  const f = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())); // 00:00 UTC
  const wd = f.getUTCDay();
  let daysAhead = (6 - wd + 7) % 7; // to Saturday
  let target = new Date(f.getTime() + daysAhead * 86400000);
  if (+from >= +target) target = new Date(target.getTime() + 7 * 86400000);
  return target; // Date di 00:00 UTC Sabtu
}
