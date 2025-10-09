import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies, ensureUserIdCookie } from "@/lib/user-id";

// kunci dasar
const cKey = (id: string) => `likes:count:${id}`;                // total like per art (number)
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`; // flag like user (number >0 berarti liked)

// leaderboard (opsional, aman kalau belum dipakai)
const Z_ART = "lb:art"; // leaderboard per-art (global total)

export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({} as any));
  if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

  const res = NextResponse.json({ success: true } as any);

  // pastikan ada user id cookie
  let uid = await getUserIdFromCookies();
  if (!uid) uid = await ensureUserIdCookie(res);

  const userFlagKey = uKey(uid!, id);

  // apakah user sudah like sebelumnya?
  const current = await kv.get<number | null>(userFlagKey);
  const alreadyLiked = (current ?? 0) > 0;

  let liked: boolean;
  let count: number;

  if (!alreadyLiked) {
    // LIKE
    const [newCount] = await Promise.all([
      kv.incr(cKey(id)),
      kv.incr(userFlagKey),
      kv.zincrby(Z_ART, 1, id).catch(() => 0), // ignore kalau ZSET belum ada/opsional
    ]);
    count = Number(newCount ?? 0);
    liked = true;
  } else {
    // UNLIKE (hindari negatif)
    const currTotal = Number((await kv.get<number | null>(cKey(id))) ?? 0);
    if (currTotal > 0) {
      const [afterDecr] = await Promise.all([
        kv.decr(cKey(id)),
        kv.decr(userFlagKey),
        kv.zincrby(Z_ART, -1, id).catch(() => 0),
      ]);
      count = Math.max(0, Number(afterDecr ?? 0));
    } else {
      // kalau sudah 0, jangan di-decr lagi
      await kv.decr(userFlagKey).catch(() => 0);
      count = 0;
    }
    liked = false;
  }

 return NextResponse.json({ success: true, liked, count }, { headers: res.headers });