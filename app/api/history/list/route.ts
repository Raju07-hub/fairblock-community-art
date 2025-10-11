export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get("scope") || "daily").toLowerCase();
    if (scope !== "daily" && scope !== "weekly") {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const raw = (await (kv as any).smembers(`lb:index:${scope}`)) as string[] | null;
    const items = (raw || [])
      .filter(Boolean)
      .sort((a, b) => (a < b ? 1 : -1)); // newest first

    return NextResponse.json({ success: true, scope, items });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "failed" }, { status: 500 });
  }
}
