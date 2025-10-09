// app/api/like/route.ts
import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies, ensureUserIdCookie } from "@/lib/user-id";

const cKey = (id: string) => `likes:count:${id}`;
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`;

export async function POST(req: Request) {
  const { id, author } = await req.json().catch(() => ({}));
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
  }

  const res = NextResponse.json({ success: true } as any);
  let uid = await getUserIdFromCookies();
  if (!uid) uid = await ensureUserIdCookie(res);

  const userFlagKey = uKey(uid, id);
  const current = await kv.get(userFlagKey); // 🔥 tanpa <number|null>
  const already = (current ?? 0) > 0;

  let liked: boolean;
  let count: number;

  if (already) {
    // UNLIKE
    const curCount = (await kv.get(cKey(id))) ?? 0; // 🔥 tanpa <number|null>
    count = Math.max(0, Number(curCount) - 1);
    await Promise.all([
      kv.set(cKey(id), count),
      kv.decr(userFlagKey),
    ]);
    liked = false;
  } else {
    // LIKE
    const newCount = await kv.incr(cKey(id));
    await kv.incr(userFlagKey);
    liked = true;
    count = newCount;
  }

  // optional leaderboard
  await kv.zincrby("lb:arts:all", liked ? 1 : -1, id).catch(() => {});

  return NextResponse.json({ success: true, liked, count, id, author });
}
