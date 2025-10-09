import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies } from "@/lib/user-id";

const cKey = (id: string) => `likes:count:${id}`;
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("ids") || "";
    const ids = raw.split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    const uid = (await getUserIdFromCookies()) || "anon";

    const countKeys = ids.map(cKey);
    const userKeys  = ids.map(id => uKey(uid, id));

    // ❌ HAPUS generic: kv.mget<number>(...)
    // ✅ Gunakan cast array:
    const counts = (await kv.mget(...countKeys)) as (number | null)[];
    const flags  = (await kv.mget(...userKeys))  as (number | null)[];

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
