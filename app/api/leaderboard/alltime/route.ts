export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";

type BlobItem = { url: string; pathname?: string; key?: string };
type ListResult = { blobs: BlobItem[]; cursor?: string | null };
type ListFn = (opts: any) => Promise<ListResult>;

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
        const meta = await r.json();
        if (meta?.id) metas.push(meta);
      } catch {}
      fetched++;
      if (fetched >= limit) break;
    }
    cursor = next || undefined;
  } while (cursor && fetched < limit);
  return metas;
}

async function scanAllLikes(pattern = "likes:count:*", page = 500) {
  const results: Array<{ id: string; count: number }> = [];
  let cursor: string | undefined = undefined;
  while (true) {
    // @ts-ignore
    const resp = await (kv as any).keys(pattern, { cursor, count: page });
    const keys: string[] = resp.keys ?? resp;
    cursor = resp.cursor || undefined;
    if (!keys || keys.length === 0) break;
    const ids = keys.map(k => k.replace("likes:count:", ""));
    const counts = (await kv.mget(...keys)) as (number | null)[];
    ids.forEach((id, i) => {
      const cnt = Number(counts[i] ?? 0);
      if (cnt > 0) results.push({ id, count: cnt });
    });
    if (!cursor) break;
  }
  return results;
}

function ownerFromMeta(m: any): string {
  const x = (m?.x || "").toString().trim().replace(/^@/, "");
  if (x) return `@${x.toLowerCase()}`;
  const d = (m?.discord || "").toString().trim().replace(/^@/, "");
  return d ? `@${d.toLowerCase()}` : "";
}

export async function GET() {
  try {
    // Top Art (tetap dari likes all-time)
    const rows = await scanAllLikes();
    const metaList = await loadAllMetas();
    const metaMap = new Map(metaList.map((m) => [String(m.id), m]));

    const top_art = rows
      .sort((a, b) => b.count - a.count)
      .slice(0, 100)
      .map(it => {
        const m = metaMap.get(it.id);
        return {
          id: it.id,
          likes: it.count,
          title: m?.title ?? `#${it.id}`,
          owner: m ? (m.x || m.discord || "") : "",
          imageUrl: m?.imageUrl || m?.url || null,
        };
      });

    // Top Creators All-Time = total uploads (dari semua meta)
    const byCreator: Record<string, number> = {};
    for (const m of metaList) {
      const o = ownerFromMeta(m);
      if (!o) continue;
      byCreator[o] = (byCreator[o] || 0) + 1;
    }
    const top_creators = Object.entries(byCreator)
      .map(([user, uploads]) => ({ user, uploads }))
      .sort((a, b) => b.uploads - a.uploads)
      .slice(0, 100);

    return NextResponse.json({
      scope: "alltime",
      top_art,
      top_creators, // uploads-based
      total_items: rows.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
