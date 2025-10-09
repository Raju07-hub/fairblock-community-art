// app/api/likes/route.ts
export const runtime = "edge";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { cookies } from "next/headers";

const COOKIE_NAME = "fb_uid"; // samakan dengan yang kamu set di lib/user-id.ts
const cKey   = (id: string) => `fb:art:${id}:count`;
const seenKey= (id: string) => `fb:art:${id}:seen`;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ success: true, data: {} });
  }

  const c = await cookies();
  const uid = c.get(COOKIE_NAME)?.value || "anon";

  // Ambil semua count; JANGAN beri generic ke mget, lalu cast hasilnya.
  const raw = (await kv.mget(...ids.map(id => cKey(id)))) as (number | null)[];

  const data: Record<string, { count: number; liked: boolean }> = {};

  // Cek apakah user ini sudah like (pakai set membership)
  await Promise.all(
    ids.map(async (id, i) => {
      const count = Number(raw?.[i] ?? 0);
      const liked = !!(await kv.sismember(seenKey(id), uid));
      data[id] = { count, liked };
    })
  );

  return NextResponse.json({ success: true, data });
}
