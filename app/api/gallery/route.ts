export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const dataFile = path.join(process.cwd(), "data", "gallery.json");
    let items = [];
    try {
      items = JSON.parse(await fs.readFile(dataFile, "utf-8"));
    } catch {}
    // jangan kirim token ke client
    const publicItems = items.map((it: any) => ({
      id: it.id,
      title: it.title,
      x: it.x,
      discord: it.discord,
      url: it.url,
      createdAt: it.createdAt,
    }));
    return NextResponse.json({ success: true, items: publicItems });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}
