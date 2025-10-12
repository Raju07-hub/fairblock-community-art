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

const CANDIDATE_PREFIXES = [
  process.env.BLOB_META_PREFIX,
  "fairblock/meta/",
  "fb/meta/",
  "fairblockcom/meta/",
].filter(Boolean) as string[];

async function listWithFallback(list: ListFn) {
  for (const prefix of CANDIDATE_PREFIXES) {
    const r = await list({ token: process.env.BLOB_READ_WRITE_TOKEN, prefix, limit: 1000 });
    if (r.blobs?.length) return { source: `prefix:${prefix}`, blobs: r.blobs };
  }
  const rAll = await list({ token: process.env.BLOB_READ_WRITE_TOKEN, limit: 1000 });
  // ambil semua di folder meta (tanpa paksa .json)
  const blobs = (rAll.blobs || []).filter((b) => typeof b.pathname === "string" && /\/meta\//i.test(b.pathname!));
  return { source: "fallback:scan-all", blobs };
}

async function parseJsonTolerant(res: Response) {
  const ct = res.headers.get("content-type") || "";
  try {
    if (/application\/json/i.test(ct)) return await res.json();
  } catch {}
  try {
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch {
      // kemungkinan “key=value” atau teks lain — kembalikan apa adanya biar bisa diinspeksi via debug
      return { __raw: txt };
    }
  } catch {
    return null;
  }
}

function pickImageUrl(meta: any): string {
  const candidates = [meta?.imageUrl, meta?.url, meta?.image, meta?.fileUrl];
  const first = candidates.find((v) => typeof v === "string" && v.trim());
  if (!first) return "";
  const s = String(first);
  if (/^https?:\/\//i.test(s)) return s;
  // jika bukan URL tapi kelihatan seperti path blob (contoh: fairblock/images/xxx.png), biarkan kosong dulu
  return "";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const debugLevel = Number(searchParams.get("debug") || "0");

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: true, items: [], nextCursor: null, count: 0, note: "missing BLOB_READ_WRITE_TOKEN" },
        { headers: headerNoStore() }
      );
    }

    const { list } = (await import("@vercel/blob")) as { list: ListFn };
    const { source, blobs } = await listWithFallback(list);

    const bust = Date.now();

    // ── DEBUG LEVEL 2: tampilkan sampel isi meta (tanpa memproses jadi items) ──
    if (debugLevel >= 2) {
      const sample = await Promise.all(
        (blobs || []).slice(0, 5).map(async (b) => {
          try {
            const r = await fetch(`${b.url}?v=${bust}`, { cache: "no-store" });
            const ct = r.headers.get("content-type") || "";
            let preview = "";
            try {
              const txt = await r.text();
              preview = txt.slice(0, 200);
            } catch {}
            return { pathname: b.pathname, url: b.url, contentType: ct, preview };
          } catch {
            return { pathname: b.pathname, url: b.url, contentType: "error", preview: "" };
          }
        })
      );
      return NextResponse.json(
        { success: true, _debug: { source, listed: blobs?.length || 0, sample } },
        { headers: headerNoStore() }
      );
    }

    // ── PRODUKSI: proses semua meta ──
    const items = await Promise.all(
      (blobs || []).map(async (b) => {
        try {
          const res = await fetch(`${b.url}?v=${bust}`, { cache: "no-store" });
          if (!res.ok) return null;

          const meta = await parseJsonTolerant(res);
          if (!meta || typeof meta !== "object") return null;

          // Jika file bukan JSON (punya __raw), kita tidak bisa pakai → skip
          if ((meta as any).__raw) return null;

          const imageUrl = pickImageUrl(meta);
          if (!meta?.id || !imageUrl) return null;

          let createdAt = "";
          if (typeof meta.createdAt === "string") createdAt = meta.createdAt;
          else if (typeof meta.createdAt === "number" && Number.isFinite(meta.createdAt)) {
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
            ownerTokenHash: typeof meta.ownerTokenHash === "string" ? meta.ownerTokenHash : "",
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

    return NextResponse.json(
      { success: true, items: filtered, nextCursor: null, count: filtered.length, _debug: { source, listed: blobs?.length || 0 } },
      { headers: headerNoStore() }
    );
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to fetch gallery" },
      { status: 500, headers: headerNoStore() }
    );
  }
}
