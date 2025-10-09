// app/api/likes/route.ts
import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies, ensureUserIdCookie } from "@/lib/user-id";

/**
 * GET /api/likes?ids=id1,id2,id3
 * Mengembalikan: { success, data: { [id]: { count, liked } } }
 * - count global diambil dari KV
 * - liked berdasar cookie user anonim (per browser)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = (searchParams.get("ids") || "").trim();
    if (!idsParam) return NextResponse.json({ success: true, data: {} });

    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ success: true, data: {} });

    // pastikan kita punya userId (untuk status liked)
    const userId = getUserIdFromCookies() || ensureUserIdCookie();
    const likedKey = `likes:user:${userId}`;

    // ambil set yang sudah di-like user ini
    let likedSet = new Set<string>();
    try {
      const arr = (await kv.smembers<string[]>(likedKey)) || [];
      likedSet = new Set(arr as string[]);
    } catch {
      // ignore
    }

    // ambil count secara batch
    const countKeys = ids.map((id) => `likes:count:${id}`);
    const counts = (await kv.mget(...countKeys)) as (string | number | null)[];

    const out: Record<string, { count: number; liked: boolean }> = {};
    ids.forEach((id, i) => {
      const v = counts[i];
      const n = typeof v === "number" ? v : v ? Number(v) : 0;
      out[id] = { count: n || 0, liked: likedSet.has(id) };
    });

    return NextResponse.json({ success: true, data: out });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err?.message || "Failed" }, { status: 400 });
  }
}
