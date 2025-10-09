// app/api/likes/route.ts
import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies } from "@/lib/user-id";

const cKey = (id: string) => `likes:count:${id}`;
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`;

/**
 * GET /api/likes?ids=a,b,c
 * Balikkan { id: { count, liked } } utk semua id.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("ids") || "";
    const ids = raw
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    const uid = (await getUserIdFromCookies()) || "anon";

    // mget counts: (number|null)[]
    const countKeys = ids.map(cKey);
    const counts = await kv.mget<number>(...countKeys);

    // mget per-user flags: (number|null)[]
    const userKeys = ids.map(id => uKey(uid, id));
    const flags = await kv.mget<number>(...userKeys);

    const data: Record<string, { count: number; liked: boolean }> = {};
    for (let i = 0; i < ids.length; i++) {
      const cnt = counts[i] ?? 0;
      const flg = (flags[i] ?? 0) > 0;
      data[ids[i]] = { count: Number(cnt), liked: Boolean(flg) };
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
