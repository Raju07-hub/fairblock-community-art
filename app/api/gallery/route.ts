// app/api/gallery/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

type BlobItem = { url: string; pathname?: string; key?: string };
type ListResult = { blobs: BlobItem[]; cursor?: string | null };
type ListFn = (opts: any) => Promise<ListResult>;

export async function GET() {
  try {
    // Jika belum set token, kembalikan list kosong (aman di prod)
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({
        success: true,
        items: [],
        nextCursor: null,
        count: 0,
      });
    }

    const { list } = (await import("@vercel/blob")) as { list: ListFn };

    // Ambil maksimal 100 metadata terbaru (bisa ditambah pagination nanti)
    const { blobs } = await list({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      prefix: "fairblock/meta/",
      limit: 100,
    });

    const items = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(b.url, { cache: "no-store" });
          if (!res.ok) return null;
          const meta = await res.json();

          // NOTE: submit route baru pakai `imageUrl`. Fallback ke `url` kalau meta lama.
          const imageUrl: string | undefined = meta.imageUrl || meta.url;

          if (!meta?.id || !meta?.title || !imageUrl) return null;

          return {
            id: String(meta.id),
            title: String(meta.title),
            x: meta.x ? String(meta.x) : undefined,
            discord: meta.discord ? String(meta.discord) : undefined,
            url: imageUrl,          // <- dipakai GalleryPage
            createdAt: String(meta.createdAt || ""),
            metaUrl: b.url,         // <- penting untuk delete admin/owner
          };
        } catch {
          return null;
        }
      })
    );

    const filtered = (items.filter(Boolean) as any[]).sort(
      (a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0)
    );

    return NextResponse.json({
      success: true,
      items: filtered,
      nextCursor: null,
      count: filtered.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to fetch gallery" },
      { status: 500 }
    );
  }
}
