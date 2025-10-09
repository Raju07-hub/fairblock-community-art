export const runtime = "edge";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import kv from "@/lib/kv";

const COOKIE = "fb_uid";
const countKey = (id: string) => `fb:art:${id}:count`;
const seenKey  = (id: string) => `fb:art:${id}:seen`;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ success: true, data: {} });

  const c = await cookies();
  const uid = c.get(COOKIE)?.value || "anon";

  // ambil semua count (no generic supaya tidak bentrok typing)
  const counts = (await kv.mget(...ids.map((id) => countKey(id)))) as (number | null)[];
  const data: Record<string, { count: number; liked: boolean }> = {};

  await Promise.all(
    ids.map(async (id, i) => {
      const cnt = Number(counts?.[i] ?? 0);
      const liked = !!(await kv.sismember(seenKey(id), uid));
      data[id] = { count: cnt, liked };
    })
  );

  return NextResponse.json({ success: true, data });
}
