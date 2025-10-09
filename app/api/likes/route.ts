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
  if (!ids.length) {
    return NextResponse.json({ success: true, data: {} });
  }

  const res = NextResponse.json({ success: true } as any);

  // pastikan cookie user
  let uid = await getUserIdFromCookies();
  if (!uid) uid = await ensureUserIdCookie(res);

  // ambil counts batch
  const countKeys = ids.map(id => cKey(id));
  const counts = await kv.mget<number | null>(...countKeys); // (number|null)[]

  // cek liked per id (paralel biar cepat)
  const data: Record<string, { count: number; liked: boolean }> = {};
  await Promise.all(
    ids.map(async (id, idx) => {
      const cnt = counts[idx] ?? 0;
      const uf = await kv.get<number | null>(uKey(uid!, id));
      data[id] = {
        count: cnt,
        liked: (uf ?? 0) > 0,
      };
    })
  );

  return NextResponse.json(
    { success: true, data },
    { headers: res.headers, cookies: (res as any).cookies }
  );
}
