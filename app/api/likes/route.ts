// app/api/likes/route.ts
import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies, ensureUserIdCookie } from "@/lib/user-id";

const cKey = (id: string) => `likes:count:${id}`;
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsStr = searchParams.get("ids") || "";
  const ids = idsStr.split(",").map(s => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ success: true, data: {} });
  }

  // --- identitas user dari cookie (untuk flag "liked")
  let uid = await getUserIdFromCookies();

  // --- ambil counts (batch)
  const countKeys = ids.map((id) => cKey(id));
  const counts = (await kv.mget(...countKeys)) as (number | null)[];

  // --- susun data dan baca flag liked per-art
  const data: Record<string, { count: number; liked: boolean }> = {};
  await Promise.all(
    ids.map(async (id, idx) => {
      const rawCount = counts[idx] ?? 0;
      let liked = false;

      if (uid) {
        const uf = (await kv.get(uKey(uid, id))) as number | null;
        liked = Number(uf ?? 0) > 0;
      }

      data[id] = {
        count: Number(rawCount ?? 0),
        liked,
      };
    })
  );

  // --- bentuk response
  const res = NextResponse.json({ success: true, data });

  // kalau belum ada uid, pasang cookie sekarang di response
  if (!uid) {
    await ensureUserIdCookie(res);
  }

  return res;
}
