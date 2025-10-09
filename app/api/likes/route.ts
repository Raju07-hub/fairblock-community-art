import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies } from "@/lib/user-id";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = (searchParams.get("ids") || "").trim();
    const ids = idsParam ? idsParam.split(",").map(s => s.trim()).filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    const uid = await getUserIdFromCookies(); // <- AWAIT di sini
    const data: Record<string, { count: number; liked: boolean }> = {};

    for (const id of ids) {
      const count = Number((await kv.get<number>(`likes:count:${id}`)) || 0);
      let liked = false;
      if (uid) {
        liked = Boolean(await kv.sismember(`likes:user:${uid}`, id));
      }
      data[id] = { count, liked };
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err?.message || "Error" }, { status: 400 });
  }
}
