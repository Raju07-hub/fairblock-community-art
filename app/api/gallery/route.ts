// app/api/gallery/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

type ListFn = (opts: any) => Promise<{ blobs: Array<{ url: string; pathname?: string; key?: string }>; cursor?: string|null }>;

export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ success:true, items:[], nextCursor:null, count:0 });
    }

    const { list } = await import("@vercel/blob") as { list: ListFn };

    // ambil maksimal 100 metadata terbaru
    const { blobs } = await list({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      prefix: "fairblock/meta/",
      limit: 100,
    });

    const items = await Promise.all(
      blobs.map(async (b) => {
        const res = await fetch(b.url, { cache: "no-store" });
        if (!res.ok) return null;
        const meta = await res.json();
        return {
          id: meta.id,
          title: meta.title,
          x: meta.x,
          discord: meta.discord,
          url: meta.url,
          createdAt: meta.createdAt,
          metaUrl: b.url,
        };
      })
    );

    const filtered = items.filter(Boolean) as any[];
    // newest first
    filtered.sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return NextResponse.json({ success:true, items: filtered, nextCursor: null, count: filtered.length });
  } catch (e:any) {
    return NextResponse.json({ success:false, error: e?.message }, { status:500 });
  }
}
