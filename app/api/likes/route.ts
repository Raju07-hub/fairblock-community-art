import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { ensureUserId, attachUserIdCookie } from "@/lib/user-id";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") || "").split(",").map(s => s.trim()).filter(Boolean);

  const uid = await ensureUserId();
  const resData: Record<string, { count: number; liked: boolean }> = {};

  for (const id of ids) {
    const countKey = `likes:count:${id}`;
    const n = Number((await kv.get(countKey)) || 0);
    const likedKey = `likes:user:${uid}`;
    const liked = Boolean(await kv.sismember(likedKey, id));
    resData[id] = { count: n, liked };
  }

  const res = NextResponse.json({ success: true, data: resData });
  attachUserIdCookie(res, uid);
  return res;
}
