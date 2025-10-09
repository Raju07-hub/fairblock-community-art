import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { ensureUserId, attachUserIdCookie } from "@/lib/user-id";

export async function POST(req: Request) {
  const { id, author } = await req.json();
  if (!id) return NextResponse.json({ success: false, error: "Missing art id" }, { status: 400 });

  // pastikan punya uid
  const uid = await ensureUserId();

  // logic like…
  const likedKey = `likes:user:${uid}`;
  const countKey = `likes:count:${id}`;
  const already = await kv.sismember(likedKey, id);

  let liked: boolean;
  let count: number;

  if (already) {
    await kv.srem(likedKey, id);
    count = await kv.decr(countKey);
    liked = false;
  } else {
    await kv.sadd(likedKey, id);
    count = await kv.incr(countKey);
    liked = true;
  }

  const res = NextResponse.json({ success: true, liked, count });

  // kalau uid baru (tidak ada di cookie), set cookie ke response
  if (!already && typeof uid === "string") {
    attachUserIdCookie(res, uid);
  }
  return res;
}
