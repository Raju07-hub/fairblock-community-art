// app/api/likes/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies, ensureUserIdCookie } from "@/lib/user-id";

const cKey = (id: string) => `likes:count:${id}`;
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`;

// GET: batch read like status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (!ids.length) return NextResponse.json({ success: true, data: {} });

  const res = new NextResponse();
  let uid = await getUserIdFromCookies();
  if (!uid) uid = await ensureUserIdCookie(res);

  const counts = (await kv.mget(...ids.map(id => cKey(id)))) as (number | null)[];
  const data: Record<string, { count: number; liked: boolean }> = {};

  await Promise.all(ids.map(async (id, idx) => {
    const cnt = counts[idx] ?? 0;
    const uf = await kv.get<number | null>(uKey(uid!, id));
    data[id] = { count: Number(cnt) || 0, liked: (uf ?? 0) > 0 };
  }));

  return NextResponse.json({ success: true, data }, { headers: res.headers });
}

// POST: proxy ke /api/like (singular)
export async function POST(req: NextRequest) {
  const mod = await import("../like/route"); // gunakan logic yang sudah benar
  return mod.POST(req as any);
}
