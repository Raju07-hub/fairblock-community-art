// app/api/gallery/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

// Helper untuk list blob
async function listMeta(prefix: string, cursor: string | null, token: string) {
  const { list } = await import("@vercel/blob");
  return list({
    token,
    prefix,
    cursor: cursor || undefined,
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });
    }

    // meta disimpan di fairblock/meta/{id}.json
    const { blobs, hasMore, cursor: nextCursor } = await listMeta("fairblock/meta/", cursor, token);

    // Ambil maksimal 50 meta (kalau mau paging, gunakan cursor yg dikembalikan)
    const toFetch = blobs.slice(0, 50);

    // Fetch isi meta JSON paralel
    const metas = await Promise.all(
      toFetch.map(async (b) => {
        const r = await fetch(b.url, { cache: "no-store" });
        if (!r.ok) return null;
        const j = await r.json();
        return j;
      })
    );

    // Filter null dan sort newest
    const items = metas
      .filter(Boolean)
      .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return NextResponse.json({
      success: true,
      items,
      nextCursor: hasMore ? nextCursor ?? null : null,
      count: items.length,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}
