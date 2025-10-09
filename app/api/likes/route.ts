// app/api/likes/route.ts
import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies } from "@/lib/user-id";

/**
 * GET /api/likes?ids=id1,id2,id3
 * Return shape:
 * { success: true, data: { [id]: { count: number, liked: boolean } } }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = (searchParams.get("ids") || "").trim();
    if (!idsParam) return NextResponse.json({ success: true, data: {} });

    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return NextResponse.json({ success: true, data: {} });

    const userId = getUserIdFromCookies();
    const likedKey = userId ? `likes:user:${userId}` : null;

    // Ambil count & status liked
    const results: Record<string, { count: number; liked: boolean }> = {};
    const counts = await Promise.all(ids.map((id) => kv.get(`likes:count:${id}`)));
    const likedFlags = await Promise.all(
      ids.map((id) => (likedKey ? kv.sismember(likedKey, id) : Promise.resolve(false)))
    );

    ids.forEach((id, i) => {
      results[id] = {
        count: Number(counts[i] ?? 0),
        liked: Boolean(likedFlags[i]),
      };
    });

    return NextResponse.json({ success: true, data: results });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to fetch likes" }, { status: 400 });
  }
}
