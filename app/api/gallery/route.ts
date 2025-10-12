export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      return NextResponse.json({ success: true, items: [] });

    const { list } = (await import("@vercel/blob")) as { list: ListFn };
    const { blobs } = await list({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      prefix: "fairblock/meta/",
      limit: 100,
    });

    const bust = Date.now(); // ⬅️ untuk cache bust

    const items = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(`${b.url}?v=${bust}`, { cache: "no-store" });
          if (!res.ok) return null;
          const meta = await res.json();
          const imageUrl: string | undefined = meta.imageUrl || meta.url;
          if (!meta?.id || !meta?.title || !imageUrl) return null;

          return {
            id: String(meta.id),
            title: String(meta.title),
            x: normHandle(meta.x),
            discord: normHandle(meta.discord),
            postUrl: meta.postUrl ? String(meta.postUrl) : "",
            url: imageUrl + `?v=${meta.updatedAt || bust}`, // cache-bust image
            createdAt: String(meta.createdAt || ""),
            updatedAt: String(meta.updatedAt || ""),
            metaUrl: b.url,
          };
        } catch {
          return null;
        }
      })
    );

    const filtered = (items.filter(Boolean) as any[]).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(
      { success: true, items: filtered, count: filtered.length },
      {
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
          pragma: "no-cache",
          "surrogate-control": "no-store",
          "x-accel-expires": "0",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Failed to fetch gallery" }, { status: 500 });
  }
}
