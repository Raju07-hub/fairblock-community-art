// app/api/gallery/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export async function GET() {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN on server." }, { status: 500 });
    }

    // List meta files
    const metas: Array<{
      id: string;
      title: string;
      x?: string;
      discord?: string;
      url: string;       // imageUrl
      createdAt: string;
    }> = [];

    // list() may paginate; loop until done
    let cursor: string | undefined = undefined;
    do {
      const { blobs, cursor: next } = await list({
        prefix: "fairblock/meta/",
        token,
        cursor,
      });
      cursor = next;

      // fetch each meta json
      for (const b of blobs) {
        try {
          const r = await fetch(b.url, { cache: "no-store" });
          if (!r.ok) continue;
          const m = await r.json();

          // map to gallery item shape
          metas.push({
            id: m.id,
            title: m.title,
            x: m.x,
            discord: m.discord,
            url: m.imageUrl,
            createdAt: m.createdAt,
          });
        } catch {
          // skip broken meta
        }
      }
    } while (cursor);

    // newest first
    metas.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json({ success: true, items: metas });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Failed to load gallery" }, { status: 500 });
  }
}
