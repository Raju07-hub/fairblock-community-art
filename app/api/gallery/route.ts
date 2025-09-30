// app/api/gallery/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

type PublicMeta = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  url: string;
  createdAt: string;
};

type ApiItem = PublicMeta;

function parseBool(v: string | null, d = false) {
  if (v == null) return d;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export async function GET(req: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const sort = (searchParams.get("sort") || "newest").toLowerCase(); // "newest" | "oldest"
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || "32")));
    const cursor = searchParams.get("cursor"); // for pagination
    // optional flag if you ever need it:
    const _noStore = parseBool(searchParams.get("noStore"), true);

    const { list } = await import("@vercel/blob");
    // Ambil daftar file meta (public) di prefix gallery/meta/
    const listed = await list({
      prefix: "gallery/meta/",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      limit,
      cursor: cursor || undefined,
    });

    // Ambil isi meta JSON satu-satu (public fetch)
    const metas = await Promise.all(
      listed.blobs
        .filter((b) => b.pathname.endsWith(".json"))
        .map(async (b) => {
          const res = await fetch(b.url, { cache: "no-store" });
          if (!res.ok) return null;
          const meta = (await res.json()) as PublicMeta;
          return meta;
        })
    );

    let items: ApiItem[] = metas.filter(Boolean) as ApiItem[];

    // Search filter sederhana (title / x / discord)
    if (q) {
      items = items.filter((it) => {
        const hay = `${it.title || ""} ${it.x || ""} ${it.discord || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    // Sort
    items.sort((a, b) => {
      const ta = Date.parse(a.createdAt || "");
      const tb = Date.parse(b.createdAt || "");
      return sort === "oldest" ? ta - tb : tb - ta; // default newest
    });

    return NextResponse.json({
      success: true,
      items,
      nextCursor: listed.cursor || null,
      // info tambahan (optional)
      count: items.length,
    }, {
      // supaya tidak di-cache edge secara agresif
      headers: _noStore ? { "cache-control": "no-store" } : undefined,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "List failed" },
      { status: 500 }
    );
  }
}
