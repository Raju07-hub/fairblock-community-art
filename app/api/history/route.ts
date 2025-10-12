export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") || "weekly").toLowerCase();

    let setKey: string;
    if (range === "weekly") setKey = "lb:index:weekly";
    else if (range === "monthly") setKey = "lb:index:monthly";
    else
      return NextResponse.json(
        { success: false, error: "range must be 'weekly' or 'monthly'" },
        { status: 400 }
      );

    const items = await (kv as any).smembers(setKey);
    const sorted = (items || []).slice().sort().reverse();

    return NextResponse.json({ success: true, items: sorted });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "failed" }, { status: 500 });
  }
}
