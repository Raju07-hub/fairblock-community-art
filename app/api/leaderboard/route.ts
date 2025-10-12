export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { isoWeek, ym } from "@/lib/period";

function toPairs(a: any[]) {
  const out: { id: string; score: number }[] = [];
  for (let i = 0; i < a.length; i += 2) out.push({ id: String(a[i]), score: Number(a[i + 1]) });
  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") || "weekly").toLowerCase(); // weekly | monthly

    let key: string;
    if (range === "weekly") {
      key = `lb:art:weekly:${isoWeek()}`;
    } else if (range === "monthly") {
      key = `lb:art:monthly:${ym()}`;
    } else {
      return NextResponse.json(
        { success: false, error: "range must be 'weekly' or 'monthly'" },
        { status: 400 }
      );
    }

    const arr = await (kv as any).zrevrange(key, 0, 99, { withscores: true });
    const topArts = toPairs(arr);

    return NextResponse.json({ success: true, topArts });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "failed" }, { status: 500 });
  }
}
