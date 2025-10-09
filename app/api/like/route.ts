import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies } from "@/lib/user-id";

/** ISO week helper: YYYY-Www (UTC) */
function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as unknown as number) - (yearStart as unknown as number)) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Key leaderboard (daily/weekly/monthly) utk art & creator */
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
    const userId = getUserIdFromCookies();

    const likedKey = `likes:user:${userId}`;     // SET berisi id yang sudah dilike user ini
    const countKey = `likes:count:${id}`;        // total like global

    // sudah pernah like? jawab sukses tanpa apa-apa (1 like per browser)
    const already = await kv.sismember(likedKey, id);
    if (already) {
      const current = (await kv.get<number>(countKey)) || 0;
      return NextResponse.json({ success: true, liked: true, count: current });
    }

    // LIKE baru
    await kv.sadd(likedKey, id);
    const count = await kv.incr(countKey);

    // leaderboard naik
    const keys = makeNowKeys();
    await Promise.all([
      kv.zincrby(keys.artDaily, 1, id),
      kv.zincrby(keys.artWeekly, 1, id),
      kv.zincrby(keys.artMonthly, 1, id),
      author ? kv.zincrby(keys.creatorDaily, 1, author) : Promise.resolve(null),
      author ? kv.zincrby(keys.creatorWeekly, 1, author) : Promise.resolve(null),
      author ? kv.zincrby(keys.creatorMonthly, 1, author) : Promise.resolve(null),
    ]);

    return NextResponse.json({ success: true, liked: true, count });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
