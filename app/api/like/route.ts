import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies, ensureUserIdCookie } from "@/lib/user-id";
import { ym, weekSatUTC } from "@/lib/period"; // NEW

/** === Period helpers (UTC for daily helpers kept local but we don't use daily anymore) === */
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d = new Date()) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const cKey = (id: string) => `likes:count:${id}`;
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`;

const lastDailyKey  = (uid: string, id: string) => `likes:lastDaily:${uid}:${id}`;   // legacy (biarkan ada)
const lastWeeklyKey = (uid: string, id: string) => `likes:lastWeekly:${uid}:${id}`;
const lastMonthlyKey= (uid: string, id: string) => `likes:lastMonthly:${uid}:${id}`;

function lbKeys(day: string, week: string, month: string) {
  return {
    artDaily:       `lb:art:daily:${day}`,    // legacy index (boleh tetap diisi)
    artWeekly:      `lb:art:weekly:${week}`,
    artMonthly:     `lb:art:monthly:${month}`,
    creatorDaily:   `lb:creator:daily:${day}`,
    creatorWeekly:  `lb:creator:weekly:${week}`,
    creatorMonthly: `lb:creator:monthly:${month}`,
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

  const day = ymd();                 // legacy (tidak dipakai UI)
  const week = weekSatUTC();         // <-- Weekly berbasis Sabtu 00:00 UTC
  const month = ym();                // <-- Monthly (UTC+7 via period.ts)
  const keys = lbKeys(day, week, month);

  let liked: boolean;
  let count: number;

  if (alreadyLiked) {
    // UNLIKE — rollback ke periode saat like terjadi
    const curCount = (await kv.get<number | null>(cKey(id))) ?? 0;
    count = curCount > 0 ? await kv.decr(cKey(id)) : 0;
    await kv.decr(userFlagKey);
    liked = false;

    const lastDay    = (await kv.get<string | null>(lastDailyKey(uid!, id)))   || day;
    const lastWeek   = (await kv.get<string | null>(lastWeeklyKey(uid!, id)))  || week;
    const lastMonth  = (await kv.get<string | null>(lastMonthlyKey(uid!, id))) || month;
    const back = lbKeys(lastDay, lastWeek, lastMonth);

    const ops = [
      (kv as any).zincrby(back.artDaily,   -1, id),
      (kv as any).zincrby(back.artWeekly,  -1, id),
      (kv as any).zincrby(back.artMonthly, -1, id),
    ];
    if (author) {
      ops.push(
        (kv as any).zincrby(back.creatorDaily,   -1, author),
        (kv as any).zincrby(back.creatorWeekly,  -1, author),
        (kv as any).zincrby(back.creatorMonthly, -1, author),
      );
    }
    await Promise.all(ops);

    await Promise.all([
      kv.del(lastDailyKey(uid!, id)),
      kv.del(lastWeeklyKey(uid!, id)),
      kv.del(lastMonthlyKey(uid!, id)),
    ]);
  } else {
    // LIKE
    count = await kv.incr(cKey(id));
    await kv.incr(userFlagKey);
    liked = true;

    const ops = [
      (kv as any).zincrby(keys.artDaily,   1, id),   // legacy
      (kv as any).zincrby(keys.artWeekly,  1, id),
      (kv as any).zincrby(keys.artMonthly, 1, id),
    ];
    if (author) {
      ops.push(
        (kv as any).zincrby(keys.creatorDaily,   1, author), // legacy
        (kv as any).zincrby(keys.creatorWeekly,  1, author),
        (kv as any).zincrby(keys.creatorMonthly, 1, author),
      );
    }
    await Promise.all(ops);

    await Promise.all([
      kv.set(lastDailyKey(uid!, id), day),
      kv.set(lastWeeklyKey(uid!, id), week),
      kv.set(lastMonthlyKey(uid!, id), month),
      (kv as any).sadd("lb:index:daily", day),     // legacy (boleh dibiarkan)
      (kv as any).sadd("lb:index:weekly", week),
      (kv as any).sadd("lb:index:monthly", month),
    ]);
  }

  return NextResponse.json({ success: true, liked, count }, { headers: res.headers });
}
