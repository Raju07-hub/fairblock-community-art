import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { v4 as uuidv4 } from "uuid";
import { getUserId } from "@/lib/user-id";
import { getDateKeys } from "@/lib/date-keys";

export async function POST(req: NextRequest) {
  try {
    const { id, author } = await req.json();
    if (!id) throw new Error("Missing art id");

    const userId = getUserId(req);
    const likedKey = `likes:user:${userId}`;
    const countKey = `likes:count:${id}`;

    const alreadyLiked = await kv.sismember(likedKey, id);

    if (alreadyLiked) {
      // unlike
      await kv.srem(likedKey, id);
      await kv.decr(countKey);
      return NextResponse.json({ success: true, liked: false });
    }

    // like
    await kv.sadd(likedKey, id);
    await kv.incr(countKey);

    // leaderboard: update score
    const { artKey, creatorKey } = getDateKeys();
    await kv.zincrby(artKey, 1, id);
    if (author) {
      await kv.zincrby(creatorKey, 1, author);
    }

    return NextResponse.json({ success: true, liked: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
