export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { ymd, isoWeek } from "@/lib/period";

function toPairs(a: any[]) {
  const out: { id: string; score: number }[] = [];
  for (let i = 0; i < a.length; i += 2) out.push({ id: String(a[i]), score: Number(a[i + 1]) });
  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") || "daily").toLowerCase();

    const day = ymd();
    const week = isoWeek();

    const key = range === "weekly" ? `lb:art:weekly:${week}` : `lb:art:daily:${day}`;
    const arr = await (kv as any).zrevrange(key, 0, 99, { withscores: true });
    const topArts = toPairs(arr);

    return NextResponse.json({ success: true, topArts });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "failed" }, { status: 500 });
  }
}
