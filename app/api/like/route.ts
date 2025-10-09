import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies } from "@/lib/user-id";

function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as unknown as number) - (yearStart as unknown as number)) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
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

    const userId = await getUserIdFromCookies();
    const likedKey = `likes:user:${userId}`;
    const countKey = `likes:count:${id}`;

    const already = await kv.sismember(likedKey, id);

    if (already) {
      await Promise.all([kv.srem(likedKey, id), kv.decr(countKey)]);
    } else {
      await Promise.all([kv.sadd(likedKey, id), kv.incr(countKey)]);
      const keys = makeNowKeys();
      await Promise.all([
        kv.zincrby(keys.artDaily, 1, id),
        kv.zincrby(keys.artWeekly, 1, id),
        kv.zincrby(keys.artMonthly, 1, id),
        author ? kv.zincrby(keys.creatorDaily, 1, author) : Promise.resolve(),
        author ? kv.zincrby(keys.creatorWeekly, 1, author) : Promise.resolve(),
        author ? kv.zincrby(keys.creatorMonthly, 1, author) : Promise.resolve(),
      ]);
    }

    const countRaw = await kv.get<string | number>(countKey);
    const count = Number(countRaw ?? 0);

    return NextResponse.json({ success: true, liked: !already, count });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "error" }, { status: 400 });
  }
}
