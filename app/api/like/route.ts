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

  // Buat response lebih dulu agar bisa pasang cookie ke response
  const res = NextResponse.json({ success: true } as any);

  // pastikan cookie user
  let uid = await getUserIdFromCookies();
  if (!uid) uid = await ensureUserIdCookie(res);

  const userFlagKey = uKey(uid, id);
  const current = await kv.get(userFlagKey); // number | null
  const already = (current ?? 0) > 0;

  let liked: boolean;
  let count: number;

  if (already) {
    // UNLIKE
    // jaga agar tidak negatif
    const curCount = (await kv.get<number | null>(cKey(id))) ?? 0;
    count = Math.max(0, curCount - 1);
    await Promise.all([
      kv.set(cKey(id), count),
      kv.decr(userFlagKey), // atau set 0 juga boleh
    ]);
    liked = false;
  } else {
    // LIKE
    const newCount = await kv.incr(cKey(id)); // auto-initialize
    await kv.incr(userFlagKey);
    liked = true;
    count = newCount;
  }

  // (opsional) leaderboard per-art
  await kv.zincrby("lb:arts:all", liked ? 1 : -1, id).catch(() => {});

  // kembalikan status server
  res.headers.set("content-type", "application/json");
  res.body = null; // NextResponse.json sudah set body, jadi kita set lagi via return baru di bawah

  return NextResponse.json(
    { success: true, liked, count, id, author },
    { headers: res.headers, cookies: (res as any).cookies }
  );
}
