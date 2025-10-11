export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";

type BlobItem = { url: string; pathname?: string; key?: string };
type ListResult = { blobs: BlobItem[]; cursor?: string | null };
type ListFn = (opts: any) => Promise<ListResult>;

// Load all submission metas via Vercel Blob.
// We only need id/title/owner/imageUrl for joining likes.
async function loadAllMetas(limit = 2000) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [] as any[];
  const { list } = (await import("@vercel/blob")) as { list: ListFn };

  const metas: any[] = [];
  let cursor: string | undefined = undefined;
  let fetched = 0;

  do {
    const { blobs, cursor: next } = await list({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      prefix: "fairblock/meta/",
      limit: 100,
      cursor,
    });

    for (const b of blobs) {
      try {
        const r = await fetch(b.url, { cache: "no-store" });
        if (!r.ok) continue;
        const m = await r.json();
        if (!m?.id) continue;
        metas.push({
          id: String(m.id),
          title: String(m.title ?? `#${m.id}`),
          owner: String(m.x || m.discord || ""),
          imageUrl: String(m.imageUrl || m.url || ""),
        });
      } catch {}
      fetched++;
      if (fetched >= limit) break;
    }

    cursor = next || undefined;
  } while (cursor && fetched < limit);

  return metas;
}

export async function GET() {
  try {
    // 1) Load all gallery metas
    const metas = await loadAllMetas();
    if (metas.length === 0) {
      return NextResponse.json({ scope: "alltime", top_art: [], top_creators: [], total_items: 0 });
    }

    // 2) Batch read like counts for all known ids
    const ids = metas.map(m => `likes:count:${m.id}`);
    const counts = (await kv.mget(...ids)) as (number | null)[];

    // 3) Build all-time Top Art from known items + counts
    const top_art = metas
      .map((m, i) => ({ id: m.id, likes: Number(counts[i] ?? 0), title: m.title, owner: m.owner, imageUrl: m.imageUrl }))
      .filter(row => row.likes > 0)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 100);

    // 4) Build all-time Top Creators by uploads (simple count per owner)
    const byCreator: Record<string, number> = {};
    for (const m of metas) {
      const owner = String(m.owner || "").trim();
      if (!owner) continue;
      const norm = owner.startsWith("@") ? owner.toLowerCase() : `@${owner.toLowerCase()}`;
      byCreator[norm] = (byCreator[norm] || 0) + 1;
    }
    const top_creators = Object.entries(byCreator)
      .map(([user, uploads]) => ({ user, uploads }))
      .sort((a, b) => b.uploads - a.uploads)
      .slice(0, 100);

    return NextResponse.json({
      scope: "alltime",
      top_art,
      top_creators,
      total_items: metas.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to build all-time leaderboard" }, { status: 500 });
  }
}
