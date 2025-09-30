export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

type GalleryItem = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  url: string;        // image url
  createdAt: string;
  metaUrl: string;    // <- penting untuk delete
};

export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ success: true, items: [], nextCursor: null, count: 0 });
    }

    // Ambil semua file meta
    const metas = await list({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      prefix: "fairblock/meta/",
      limit: 1000,
    });

    const items: GalleryItem[] = [];
    for (const f of metas.blobs) {
      try {
        const metaUrl = f.url;
        const r = await fetch(metaUrl, { cache: "no-store" });
        if (!r.ok) continue;
        const m = await r.json();
        // validasi minimum
        if (!m?.id || !m?.imageUrl || !m?.title) continue;
        items.push({
          id: m.id,
          title: m.title,
          x: m.x,
          discord: m.discord,
          url: m.imageUrl,
          createdAt: m.createdAt || new Date().toISOString(),
          metaUrl, // ← dipakai tombol Delete
        });
      } catch {}
    }

    // urutkan terbaru
    items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return NextResponse.json({ success: true, items, nextCursor: null, count: items.length });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}
