import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { ensureUserIdCookie } from "@/lib/user-id"; // <- impor yang benar

// ... helper isoWeekKey & makeNowKeys tetap

export async function POST(req: NextRequest) {
  try {
    const { id, author } = await req.json();
    if (!id) throw new Error("Missing art id");

    const userId = await ensureUserIdCookie(); // <- AWAIT di sini
    const likedKey = `likes:user:${userId}`;
    const countKey = `likes:count:${id}`;

    const alreadyLiked = await kv.sismember(likedKey, id);

    if (alreadyLiked) {
      await kv.srem(likedKey, id);
      const newCount = await kv.decr(countKey);
      return NextResponse.json({ success: true, liked: false, count: Number(newCount) });
    }

    await kv.sadd(likedKey, id);
    const newCount = await kv.incr(countKey);

    const keys = makeNowKeys();
    await Promise.all([
      kv.zincrby(keys.artDaily, 1, id),
      kv.zincrby(keys.artWeekly, 1, id),
      kv.zincrby(keys.artMonthly, 1, id),
      author ? kv.zincrby(keys.creatorDaily, 1, author) : Promise.resolve(),
      author ? kv.zincrby(keys.creatorWeekly, 1, author) : Promise.resolve(),
      author ? kv.zincrby(keys.creatorMonthly, 1, author) : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true, liked: true, count: Number(newCount) });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err?.message || "Error" }, { status: 400 });
  }
}
