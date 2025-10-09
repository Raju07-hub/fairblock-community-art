import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies } from "@/lib/user-id";

/** GET /api/likes?ids=id1,id2,id3 */
export async function GET(req: NextRequest) {
  try {
    const ids = (req.nextUrl.searchParams.get("ids") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    const userId = await getUserIdFromCookies();
    const likedKey = `likes:user:${userId}`;

    const counts = await Promise.all(
      ids.map((id) => kv.get<string | number>(`likes:count:${id}`))
    );
    const likedFlags = await Promise.all(ids.map((id) => kv.sismember(likedKey, id)));

    const data: Record<string, { count: number; liked: boolean }> = {};
    ids.forEach((id, i) => {
      data[id] = { count: Number(counts[i] ?? 0), liked: !!likedFlags[i] };
    });

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "error" }, { status: 400 });
  }
}
