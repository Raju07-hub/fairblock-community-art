// app/api/like/route.ts
import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { ensureUserIdCookie } from "@/lib/user-id";

/** ISO week helper: YYYY-Www (UTC) */
function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // Kamis anchor (ISO)
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as unknown as number) - (yearStart as unknown as number)) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** key leaderboard (daily/weekly/monthly) utk art & creator */
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
    creatorDaily: `lb:creator:daily:${daily}`,
    artWeekly: `lb:weekly:${weekly}`,
    creatorWeekly: `lb:creator:weekly:${weekly}`,
    artMonthly: `lb:monthly:${monthly}`,
    creatorMonthly: `lb:creator:monthly:${monthly}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { id, author } = await req.json();
    if (!id) throw new Error("Missing art id");

    // pastikan cookie user id ada
    const userId = ensureUserIdCookie();
    const likedKey = `likes:user:${userId}`;
    const countKey = `likes:count:${id}`;

    // sudah like?
    const already = await kv.sismember(likedKey, id);

    if (already) {
      // UNLIKE
      await Promise.all([kv.srem(likedKey, id), kv.decr(countKey)]);
      const count = Number((await kv.get<number>(countKey)) || 0);
      return NextResponse.json({ success: true, liked: false, count });
    }

    // LIKE
    await Promise.all([kv.sadd(likedKey, id), kv.incr(countKey)]);

    // naikkan leaderboard
    const keys = makeNowKeys();
    const incs: Promise<any>[] = [
      kv.zincrby(keys.artDaily, 1, id),
      kv.zincrby(keys.artWeekly, 1, id),
      kv.zincrby(keys.artMonthly, 1, id),
    ];
    if (author) {
      incs.push(
        kv.zincrby(keys.creatorDaily, 1, author),
        kv.zincrby(keys.creatorWeekly, 1, author),
        kv.zincrby(keys.creatorMonthly, 1, author),
      );
    }
    await Promise.all(incs);

    const count = Number((await kv.get<number>(countKey)) || 0);
    return NextResponse.json({ success: true, liked: true, count });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err?.message || "Like failed" }, { status: 400 });
  }
}
