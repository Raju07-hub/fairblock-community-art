// app/api/like/route.ts
import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserId } from "@/lib/user-id";

/** ISO week helper: YYYY-Www (UTC) */
function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Kamis sebagai anchor (ISO)
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as unknown as number) - (yearStart as unknown as number)) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Membuat semua key leaderboard (daily/weekly/monthly) untuk art & creator */
function makeNowKeys() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const daily = `${yyyy}-${mm}-${dd}`;
  const weekly = isoWeekKey(now);
  const monthly = `${yyyy}-${mm}`;

  return {
    artDaily:     `lb:daily:${daily}`,
    creatorDaily: `lb:creator:daily:${daily}`,
    artWeekly:     `lb:weekly:${weekly}`,
    creatorWeekly: `lb:creator:weekly:${weekly}`,
    artMonthly:     `lb:monthly:${monthly}`,
    creatorMonthly: `lb:creator:monthly:${monthly}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { id, author } = await req.json();
    if (!id) throw new Error("Missing art id");

    const userId = getUserId(req);
    const likedKey = `likes:user:${userId}`;
    const countKey = `likes:count:${id}`;

    // Apakah user sudah like karya ini?
    const alreadyLiked = await kv.sismember(likedKey, id);

    if (alreadyLiked) {
      // UNLIKE
      await kv.srem(likedKey, id);
      await kv.decr(countKey);
      return NextResponse.json({ success: true, liked: false });
    }

    // LIKE
    await kv.sadd(likedKey, id);
    await kv.incr(countKey);

    // Naikkan skor di semua papan (daily/weekly/monthly)
    const keys = makeNowKeys();
    await Promise.all([
      kv.zincrby(keys.artDaily, 1, id),
      kv.zincrby(keys.artWeekly, 1, id),
      kv.zincrby(keys.artMonthly, 1, id),
      author ? kv.zincrby(keys.creatorDaily, 1, author) : Promise.resolve(null),
      author ? kv.zincrby(keys.creatorWeekly, 1, author) : Promise.resolve(null),
      author ? kv.zincrby(keys.creatorMonthly, 1, author) : Promise.resolve(null),
    ]);

    return NextResponse.json({ success: true, liked: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
