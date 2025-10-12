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

// Prefix kandidat; bisa override lewat env BLOB_META_PREFIX
const CANDIDATE_PREFIXES = [
  process.env.BLOB_META_PREFIX, // optional
  "fairblock/meta/",
  "fb/meta/",
  "fairblockcom/meta/",
].filter(Boolean) as string[];

async function listWithFallback(list: ListFn) {
  // 1) coba tiap prefix
  for (const prefix of CANDIDATE_PREFIXES) {
    const r = await list({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      prefix,
      limit: 1000,
    });
    if (r.blobs?.length) {
      // hanya file .json
      const blobs = (r.blobs || []).filter(
        (b) => typeof b.pathname === "string" && /\.json$/i.test(b.pathname)
      );
      if (blobs.length) return { source: `prefix:${prefix}`, blobs };
    }
  }
  // 2) fallback: scan semua lalu filter "/meta/" + .json
  const rAll = await list({
    token: process.env.BLOB_READ_WRITE_TOKEN,
    limit: 1000,
  });
  const blobs = (rAll.blobs || []).filter(
    (b) =>
      typeof b.pathname === "string" &&
      /\/meta\/.+\.json$/i.test(b.pathname)
  );
  return { source: "fallback:scan-all", blobs };
}

// Parser toleran: coba json(); kalau gagal, coba text() -> JSON.parse
async function parseJsonTolerant(res: Response) {
  const ct = res.headers.get("content-type") || "";
  try {
    if (/application\/json/i.test(ct)) return await res.json();
  } catch {}
  try {
    const txt = await res.text();
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const debug = searchParams.get("debug") === "1";

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          success: true,
          items: [],
          nextCursor: null,
          count: 0,
          note: "missing BLOB_READ_WRITE_TOKEN",
        },
        { headers: headerNoStore() }
      );
    }

    const { list } = (await import("@vercel/blob")) as { list: ListFn };

    // listing dengan fallback
    const { source, blobs } = await listWithFallback(list);

    const bust = Date.now();
    const items = await Promise.all(
      (blobs || []).map(async (b) => {
        try {
          // pastikan hanya .json yang diproses
          if (!b.pathname || !/\.json$/i.test(b.pathname)) return null;

          const res = await fetch(`${b.url}?v=${bust}`, { cache: "no-store" });
          if (!res.ok) return null;

          const meta = await parseJsonTolerant(res);
          if (!meta || typeof meta !== "object") return null;

          const fromMeta: string =
            (meta?.imageUrl as string) || (meta?.url as string) || "";
          const imageUrl =
            typeof fromMeta === "string" && /^https?:\/\//i.test(fromMeta)
              ? fromMeta
              : "";
          if (!meta?.id || !imageUrl) return null;

          // normalize createdAt
          let createdAt = "";
          if (typeof meta.createdAt === "string") createdAt = meta.createdAt;
          else if (
            typeof meta.createdAt === "number" &&
            Number.isFinite(meta.createdAt)
          ) {
            createdAt = new Date(meta.createdAt).toISOString();
          }

          return {
            id: String(meta.id),
            title: typeof meta.title === "string" ? meta.title : "",
            x: normHandle(meta.x),
            discord: normHandle(meta.discord),
            postUrl: typeof meta.postUrl === "string" ? meta.postUrl : "",
            url: imageUrl,
            createdAt,
            metaUrl: b.url,
            ownerTokenHash:
              typeof meta.ownerTokenHash === "string"
                ? meta.ownerTokenHash
                : "",
          };
        } catch {
          return null;
        }
      })
    );

    const filtered = (items.filter(Boolean) as any[]).sort((a, b) => {
      const tb = Date.parse(b.createdAt || "");
      const ta = Date.parse(a.createdAt || "");
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    const payload: any = {
      success: true,
      items: filtered,
      nextCursor: null,
      count: filtered.length,
    };
    if (debug) payload._debug = { source, listed: blobs?.length || 0 };

    return NextResponse.json(payload, { headers: headerNoStore() });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to fetch gallery" },
      { status: 500, headers: headerNoStore() }
    );
  }
}
