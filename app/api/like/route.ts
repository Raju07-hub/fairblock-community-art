// app/api/like/route.ts
import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies } from "@/lib/user-id";

/** helper keys */
const cKey = (id: string) => `likes:count:${id}`;
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`;

// leaderboard ZSET keys
const Z_ART = "lb:art:all";
const Z_CREATOR = "lb:creator:all";

/**
 * Body: { id: string, author?: string }
 * Toggle like utk user saat ini.
 * - Flag per user disimpan sebagai angka 0/1 via INCR/DECR (tanpa SET).
 * - Counter global: INCR/DECR.
 * - Leaderboard: ZINCRBY ±1 pada per-art & per-creator.
 */
export async function POST(req: Request) {
  try {
    const { id, author } = await req.json().catch(() => ({}));
    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    const uid = (await getUserIdFromCookies()) || "anon";
    const userFlagKey = uKey(uid, id);

    const current = await kv.get<number | null>(userFlagKey);
    const alreadyLiked = (current ?? 0) > 0;

    let liked: boolean;
    let newCount: number;

    if (!alreadyLiked) {
      // like -> userFlag +1 (jadi 1), count +1, leaderboard +1
      const f = await kv.incr(userFlagKey);
      liked = f > 0;
      newCount = await kv.incr(cKey(id));

      await Promise.all([
        kv.zincrby(Z_ART, 1, id),
        author ? kv.zincrby(Z_CREATOR, 1, author) : Promise.resolve(0),
      ]);
    } else {
      // unlike -> userFlag -1 (jadi 0), count -1, leaderboard -1
      await kv.decr(userFlagKey);
      liked = false;
      newCount = await kv.decr(cKey(id));

      await Promise.all([
        kv.zincrby(Z_ART, -1, id),
        author ? kv.zincrby(Z_CREATOR, -1, author) : Promise.resolve(0),
      ]);
    }

    // clamp minimal 0 utk jaga-jaga
    if (newCount < 0) {
      newCount = 0;
    }

    return NextResponse.json({ success: true, liked, count: newCount });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Like failed" }, { status: 500 });
  }
}
