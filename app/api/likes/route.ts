import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserId } from "@/lib/user-id";

/**
 * GET /api/likes?ids=id1,id2,id3
 * Mengembalikan array { id, count, liked } untuk setiap id.
 * - count  : total like publik (global)
 * - liked  : apakah user (berdasarkan cookie anon) sudah like id tsb
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = (searchParams.get("ids") || "").trim();

    // Support juga ?id=single
    const single = (searchParams.get("id") || "").trim();
    const ids = (idsParam ? idsParam.split(",") : [])
      .concat(single ? [single] : [])
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ success: true, items: [] });
    }

    // Dapatkan userId anon dari cookie (supaya bisa tandai "liked")
    const userId = getUserId(req);
    const likedKey = `likes:user:${userId}`;

    // Ambil total likes publik untuk semua id (parallel)
    const countKeys = ids.map((id) => `likes:count:${id}`);
    // @vercel/kv mendukung mget(array)
    const rawCounts = (await (kv as any).mget(countKeys)) as (number | null)[];

    // Cek apakah user sudah like tiap id
    const likedFlags = await Promise.all(ids.map((id) => kv.sismember(likedKey, id)));

    const items = ids.map((id, i) => ({
      id,
      count: Number(rawCounts[i] ?? 0),
      liked: Boolean(likedFlags[i]),
    }));

    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    console.error("GET /api/likes error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Unknown error" },
      { status: 400 }
    );
  }
}
