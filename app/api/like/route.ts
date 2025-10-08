import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserId } from "@/lib/user-id";

/** Helper: ISO Week key format (YYYY-Www UTC) */
function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // Sunday = 0 => 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as unknown as number) - (yearStart as unknown as number)) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Buat key leaderboard harian/mingguan/bulanan */
function makeNowKeys() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  const daily = `${yyyy}-${mm}-${dd}`;
  const weekly = isoWeekKey(now);
  const monthly = `${yyyy}-${mm}`;

  return {
    artDaily: `lb:art:daily:${daily}`,
    artWeekly: `lb:art:weekly:${weekly}`,
    artMonthly: `lb:art:monthly:${monthly}`,
    creatorDaily: `lb:creator:daily:${daily}`,
    creatorWeekly: `lb:creator:weekly:${weekly}`,
    creatorMonthly: `lb:creator:monthly:${monthly}`,
  };
}

/** POST /api/like — toggle like/unlike */
export async function POST(req: NextRequest) {
  try {
    const { id, author } = await req.json();
    if (!id) throw new Error("Missing art ID");

    // Buat ID user unik
    const userId = getUserId(req);

    // Key redis
    const likedKey = `likes:user:${userId}`;
    const countKey = `likes:count:${id}`;

    // Cek apakah sudah like
    const alreadyLiked = await kv.sismember(likedKey, id);

    if (alreadyLiked) {
      // UNLIKE
      await Promise.all([
        kv.srem(likedKey, id),
        kv.decr(countKey),
      ]);
      return NextResponse.json({ success: true, liked: false });
    }

    // LIKE baru
    await Promise.all([
      kv.sadd(likedKey, id),
      kv.incr(countKey),
    ]);

    // Update leaderboard
    const keys = makeNowKeys();
    const updates = [
      kv.zincrby(keys.artDaily, 1, id),
      kv.zincrby(keys.artWeekly, 1, id),
      kv.zincrby(keys.artMonthly, 1, id),
    ];

    if (author) {
      updates.push(
        kv.zincrby(keys.creatorDaily, 1, author),
        kv.zincrby(keys.creatorWeekly, 1, author),
        kv.zincrby(keys.creatorMonthly, 1, author)
      );
    }

    await Promise.all(updates);

    // Ambil jumlah likes terkini (optional untuk respon realtime)
    const newCount = (await kv.get<number>(countKey)) || 0;

    return NextResponse.json({
      success: true,
      liked: true,
      likes: newCount,
    });
  } catch (err: any) {
    console.error("Like API error:", err);
    return NextResponse.json(
      { success: false, error: err.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}
