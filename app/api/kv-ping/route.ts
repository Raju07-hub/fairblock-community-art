import kv from "@/lib/kv";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // akan error kalau env KV tidak benar
    const v = await kv.incr("debug:ping");
    return NextResponse.json({ ok: true, value: v });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
