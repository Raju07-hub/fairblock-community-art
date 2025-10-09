import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies } from "@/lib/user-id";

/** GET /api/likes?ids=id1,id2,... => { success, data: { [id]: { count, liked } } } */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids") || "";
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ success: true, data: {} });

    const userId = await getUserIdFromCookies();
    const likedKey = userId ? `likes:user:${userId}` : null;

    const out: Record<string, { count: number; liked: boolean }> = {};

    await Promise.all(
      ids.map(async (id) => {
        const [countRaw, likedRaw] = await Promise.all([
          kv.get<number>(`likes:count:${id}`),
          likedKey ? kv.sismember(likedKey, id) : Promise.resolve(false),
        ]);
        out[id] = { count: Number(countRaw || 0), liked: Boolean(likedRaw) };
      })
    );

    return NextResponse.json({ success: true, data: out });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err?.message || "Failed to fetch likes" }, { status: 400 });
  }
}
