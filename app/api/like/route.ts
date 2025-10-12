import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies, ensureUserIdCookie } from "@/lib/user-id";
import { ym } from "@/lib/period"; // NEW: pakai helper bulanan

/** === Period helpers (UTC) === */
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d = new Date()) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (date.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.floor(diff / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

// Counters & user flags
const cKey = (id: string) => `likes:count:${id}`;
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`;

// Last-like period trackers (untuk rollback unlike)
const lastDailyKey = (uid: string, id: string) => `likes:lastDaily:${uid}:${id}`;
const lastWeeklyKey = (uid: string, id: string) => `likes:lastWeekly:${uid}:${id}`;
const lastMonthlyKey = (uid: string, id: string) => `likes:lastMonthly:${uid}:${id}`; // NEW

// Leaderboard keys
function lbKeys(day: string, week: string, month: string) {
  return {
    artDaily:      `lb:art:daily:${day}`,
    artWeekly:     `lb:art:weekly:${week}`,
    artMonthly:    `lb:art:monthly:${month}`,      // NEW
    creatorDaily:  `lb:creator:daily:${day}`,
    creatorWeekly: `lb:creator:weekly:${week}`,
    creatorMonthly:`lb:creator:monthly:${month}`,  // NEW
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const author = String(body?.author || ""); // optional

  if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

  const res = new NextResponse();
  let uid = await getUserIdFromCookies();
  if (!uid) uid = await ensureUserIdCookie(res);

  const userFlagKey = uKey(uid!, id);
  const alreadyLiked = ((await kv.get<number | null>(userFlagKey)) ?? 0) > 0;

  const day = ymd();
  const week = isoWeek();
  const month = ym(); // NEW
  const keys = lbKeys(day, week, month);

  let liked: boolean;
  let count: number;

  if (alreadyLiked) {
    // === UNLIKE — rollback ke periode saat like terjadi ===
    const curCount = (await kv.get<number | null>(cKey(id))) ?? 0;
    count = curCount > 0 ? await kv.decr(cKey(id)) : 0;
    await kv.decr(userFlagKey);
    liked = false;

    const lastDay   = (await kv.get<string | null>(lastDailyKey(uid!, id)))   || day;
    const lastWeek  = (await kv.get<string | null>(lastWeeklyKey(uid!, id)))  || week;
    const lastMonth = (await kv.get<string | null>(lastMonthlyKey(uid!, id))) || month; // NEW
    const back = lbKeys(lastDay, lastWeek, lastMonth);

    const ops = [
      (kv as any).zincrby(back.artDaily,   -1, id),
      (kv as any).zincrby(back.artWeekly,  -1, id),
      (kv as any).zincrby(back.artMonthly, -1, id), // NEW
    ];
    if (author) {
      ops.push(
        (kv as any).zincrby(back.creatorDaily,   -1, author),
        (kv as any).zincrby(back.creatorWeekly,  -1, author),
        (kv as any).zincrby(back.creatorMonthly, -1, author), // NEW
      );
    }
    await Promise.all(ops);

    await Promise.all([
      kv.del(lastDailyKey(uid!, id)),
      kv.del(lastWeeklyKey(uid!, id)),
      kv.del(lastMonthlyKey(uid!, id)), // NEW
    ]);
  } else {
    // === LIKE ===
    count = await kv.incr(cKey(id));
    await kv.incr(userFlagKey);
    liked = true;

    const ops = [
      (kv as any).zincrby(keys.artDaily,   1, id),
      (kv as any).zincrby(keys.artWeekly,  1, id),
      (kv as any).zincrby(keys.artMonthly, 1, id), // NEW
    ];
    if (author) {
      ops.push(
        (kv as any).zincrby(keys.creatorDaily,   1, author),
        (kv as any).zincrby(keys.creatorWeekly,  1, author),
        (kv as any).zincrby(keys.creatorMonthly, 1, author), // NEW
      );
    }
    await Promise.all(ops);

    await Promise.all([
      kv.set(lastDailyKey(uid!, id), day),
      kv.set(lastWeeklyKey(uid!, id), week),
      kv.set(lastMonthlyKey(uid!, id), month), // NEW
      // index periods untuk history
      (kv as any).sadd("lb:index:daily", day),
      (kv as any).sadd("lb:index:weekly", week),
      (kv as any).sadd("lb:index:monthly", month), // NEW
    ]);
  }

  return NextResponse.json({ success: true, liked, count }, { headers: res.headers });
}
