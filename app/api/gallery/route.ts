// app/api/gallery/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

type BlobItem = { url: string; pathname?: string; key?: string };
type ListResult = { blobs: BlobItem[]; cursor?: string | null };
type ListFn = (opts: any) => Promise<ListResult>;

function normHandle(v?: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  const noAt = s.replace(/^@/, "");
  return `@${noAt}`;
}

function headerNoStore() {
  return {
    "cache-control": "no-store, no-cache, must-revalidate",
    pragma: "no-cache",
    "surrogate-control": "no-store",
    "x-accel-expires": "0",
  };
}

export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: true, items: [], nextCursor: null, count: 0 },
        { headers: headerNoStore() }
      );
    }

    const { list } = (await import("@vercel/blob")) as { list: ListFn };
    const { blobs } = await list({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      prefix: "fairblock/meta/",
      limit: 500, // cukup tinggi supaya tidak kepotong
    });

    const bust = Date.now();

    const items = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(`${b.url}?v=${bust}`, { cache: "no-store" });
          if (!res.ok) return null;
          const meta = await res.json();

          // Robust image URL: pakai imageUrl lalu fallback ke url; keduanya harus http(s)
          const fromMeta = (meta?.imageUrl as string) || (meta?.url as string) || "";
          const imageUrl =
            typeof fromMeta === "string" && /^https?:\/\//i.test(fromMeta) ? fromMeta : "";

          // Minimal syarat: ada id & imageUrl agar bisa dirender
          if (!meta?.id || !imageUrl) return null;

          return {
            id: String(meta.id),
            title: typeof meta.title === "string" ? meta.title : "", // jangan buang item hanya karena title kosong
            x: normHandle(meta.x),
            discord: normHandle(meta.discord),
            postUrl: typeof meta.postUrl === "string" ? meta.postUrl : "",
            url: imageUrl,
            createdAt: typeof meta.createdAt === "string" ? meta.createdAt : "", // biar sorter client yang menormalkan
            metaUrl: b.url,
            ownerTokenHash: typeof meta.ownerTokenHash === "string" ? meta.ownerTokenHash : "",
          };
        } catch {
          return null;
        }
      })
    );

    // Urutkan newest dengan toleransi (createdAt kosong akan dianggap 0 di client)
    const filtered = (items.filter(Boolean) as any[]).sort((a, b) => {
      const tb = Date.parse(b.createdAt || "");
      const ta = Date.parse(a.createdAt || "");
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    return NextResponse.json(
      { success: true, items: filtered, nextCursor: null, count: filtered.length },
      { headers: headerNoStore() }
    );
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to fetch gallery" },
      { status: 500, headers: headerNoStore() }
    );
  }
}
