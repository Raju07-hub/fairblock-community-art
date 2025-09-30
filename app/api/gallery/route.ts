// app/api/gallery/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

const META_PREFIX = "gallery/meta/";

export async function GET() {
  try {
    // Ambil semua meta JSON (paginate jika perlu)
    let cursor: string | undefined = undefined;
    const metas: any[] = [];

    do {
      const res = await list({ prefix: META_PREFIX, cursor, token: process.env.BLOB_READ_WRITE_TOKEN });
      for (const b of res.blobs) {
        // fetch meta JSON (public) → parse
        const r = await fetch(b.url, { cache: "no-store" });
        if (!r.ok) continue;
        const meta = await r.json();
        metas.push(meta);
      }
      cursor = res.cursor;
    } while (cursor);

    // Urutkan terbaru dulu (createdAt desc) & buang deleteToken sebelum kirim
    metas.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const items = metas.map((it) => ({
      id: it.id,
      title: it.title,
      x: it.x,
      discord: it.discord,
      url: it.url,
      createdAt: it.createdAt,
    }));

    return NextResponse.json({ success: true, items });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "List failed" }, { status: 500 });
  }
}
