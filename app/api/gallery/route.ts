// app/api/gallery/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

type GalleryItem = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  url: string;       // imageUrl
  createdAt: string;
};

export async function GET() {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    const items: GalleryItem[] = [];
    let totalBlobs = 0;

    // paginasi aman (tanpa slash di prefix agar fleksibel)
    let cursor: string | undefined = undefined;
    do {
      const { blobs, cursor: next } = await list({
        prefix: "fairblock/meta",
        token,
        cursor,
      });
      cursor = next;
      totalBlobs += blobs.length;

      // ambil semua meta paralel
      const results = await Promise.allSettled(
        blobs.map(async (b) => {
          const res = await fetch(b.url, { cache: "no-store" });
          if (!res.ok) return null;
          const m = await res.json().catch(() => null);
          if (!m?.id || !m?.imageUrl || !m?.createdAt) return null;
          const gi: GalleryItem = {
            id: m.id,
            title: m.title ?? "",
            x: m.x ?? "",
            discord: m.discord ?? "",
            url: m.imageUrl,
            createdAt: m.createdAt,
          };
          return gi;
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) items.push(r.value);
      }
    } while (cursor);

    // urut terbaru di atas
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json({
      success: true,
      items,
      debug: { totalBlobs, returned: items.length },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to load gallery" },
      { status: 500 }
    );
  }
}
