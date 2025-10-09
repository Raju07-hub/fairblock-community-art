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

  // --- pastikan user id (dari cookie)
  let uid = await getUserIdFromCookies();
  if (!uid) uid = await ensureUserIdCookie(res);

  const userFlagKey = uKey(uid, id);
  const current = (await kv.get(userFlagKey)) as number | null;
  const already = (current ?? 0) > 0;

  let liked = false;
  let count = 0;

  if (already) {
    // ---- UNLIKE ----
    const curCount = (await kv.get(cKey(id))) as number | null;
    const newCount = Math.max(0, Number(curCount ?? 0) - 1);
    // SDK baru tidak punya set, jadi pakai hset
    await Promise.all([
      kv.hset("likes_table", { [id]: newCount }), // simpan semua count dalam 1 hash
      kv.decr(userFlagKey),
    ]);
    liked = false;
    count = newCount;
  } else {
    // ---- LIKE ----
    const newCount = await kv.incr(cKey(id));
    await kv.incr(userFlagKey);
    liked = true;
    count = newCount;
  }

  // optional leaderboard (biar tidak error kalau belum ada key)
  try {
    await kv.zincrby("lb:arts:all", liked ? 1 : -1, id);
  } catch {}

  return NextResponse.json({ success: true, id, author, liked, count });
}
