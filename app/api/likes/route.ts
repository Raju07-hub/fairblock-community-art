// app/api/likes/route.ts
export const runtime = "edge";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { cookies } from "next/headers";
import { COOKIE_META } from "@/lib/user-id";

const cKey = (id: string) => `fb:art:${id}:count`;
const seenKey = (id: string) => `fb:art:${id}:seen`;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") || "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({ success: true, data: {} });

  const c = await cookies();
  const uid = c.get(COOKIE_META.name)?.value || "anon";

  // mget count
  const counts = await kv.mget<number | null>(...ids.map((id) => cKey(id)));
  const data: Record<string, { count: number; liked: boolean }> = {};

  await Promise.all(
    ids.map(async (id, i) => {
      const count = Number(counts?.[i] ?? 0);
      const liked = !!(await kv.sismember(seenKey(id), uid));
      data[id] = { count, liked };
    })
  );

  return NextResponse.json({ success: true, data });
}
