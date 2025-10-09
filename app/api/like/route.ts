// app/api/like/route.ts
import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies, ensureUserIdCookie } from "@/lib/user-id";

/** ISO week helper: YYYY-Www (UTC) */
function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // ISO anchor Thu
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as unknown as number) - (yearStart as unknown as number)) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Semua key leaderboard (daily/weekly/monthly) untuk art & creator */
function makeNowKeys() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const daily = `${yyyy}-${mm}-${dd}`;
  const weekly = isoWeekKey(now);
  const monthly = `${yyyy}-${mm}`;

  return {
    artDaily: `lb:daily:${daily}`,
    artWeekly: `lb:weekly:${weekly}`,
    artMonthly: `lb:monthly:${monthly}`,
    creatorDaily: `lb:creator:daily:${daily}`,
    creatorWeekly: `lb:creator:weekly:${weekly}`,
    creatorMonthly: `lb:creator:monthly:${monthly}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { id, author } = await req.json();
    if (!id) throw new Error("Missing art id");

    // pastikan userId ada di cookie
    const userId = getUserIdFromCookies() || ensureUserIdCookie();
    const likedKey = `likes:user:${userId}`;
    const countKey = `likes:count:${id}`;

    const already = await kv.sismember(likedKey, id);

    if (already) {
      // UNLIKE
      await kv.srem(likedKey, id);

      // cegah negatif
      const cur = Number((await kv.get(countKey)) || 0);
      const next = Math.max(0, cur - 1);
      if (next === 0) {
        // optional: rapihin dengan del atau set 0
        await kv.set(countKey, 0);
      } else {
        await kv.decr(countKey);
      }

      // balikin count terbaru
      const fresh = Number((await kv.get(countKey)) || 0);
      return NextResponse.json({ success: true, liked: false, count: fresh });
    }

    // LIKE
    await kv.sadd(likedKey, id);
    await kv.incr(countKey);

    // update leaderboard
    const keys = makeNowKeys();
    await Promise.all([
      kv.zincrby(keys.artDaily, 1, id),
      kv.zincrby(keys.artWeekly, 1, id),
      kv.zincrby(keys.artMonthly, 1, id),
      author ? kv.zincrby(keys.creatorDaily, 1, author) : Promise.resolve(null),
      author ? kv.zincrby(keys.creatorWeekly, 1, author) : Promise.resolve(null),
      author ? kv.zincrby(keys.creatorMonthly, 1, author) : Promise.resolve(null),
    ]);

    const fresh = Number((await kv.get(countKey)) || 0);
    return NextResponse.json({ success: true, liked: true, count: fresh });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err?.message || "Like failed" }, { status: 400 });
  }
}
