export const runtime = "edge";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import kv from "@/lib/kv";

const COOKIE = "fb_uid";

const countKey = (id: string) => `fb:art:${id}:count`;
const seenKey  = (id: string) => `fb:art:${id}:seen`;

export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

  const c = await cookies();
  const uid = c.get(COOKIE)?.value || "anon";

  // toggle: jika belum like → like; kalau sudah → unlike
  const already = !!(await kv.sismember(seenKey(id), uid));
  let liked = true;
  let count: number;

  if (!already) {
    await kv.sadd(seenKey(id), uid);
    count = await kv.incr(countKey(id));
    liked = true;
  } else {
    await kv.srem(seenKey(id), uid);
    // jaga jangan negatif
    const after = await kv.decr(countKey(id));
    count = Math.max(0, after);
    liked = false;
  }

  return NextResponse.json({ success: true, liked, count });
}
