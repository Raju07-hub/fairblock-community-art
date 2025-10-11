// app/api/history/[scope]/[period]/route.ts
import { NextResponse, NextRequest } from "next/server";
import kv from "@/lib/kv";
import { ymd, isoWeek, prevYmd, prevIsoWeek } from "@/lib/period";

// ---- BLOB meta loader (dipakai untuk hitung uploads creator) ----
type BlobItem = { url: string; pathname?: string; key?: string };
type ListResult = { blobs: BlobItem[]; cursor?: string | null };
type ListFn = (opts: any) => Promise<ListResult>;

async function loadAllMetas(limit = 1000) {
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

function pairs(a: any[]) {
  const out: { id: string; score: number }[] = [];
  for (let i = 0; i < a.length; i += 2) out.push({ id: String(a[i]), score: Number(a[i + 1]) });
  return out;
}

function keys(scope: "daily" | "weekly", period: "current" | "previous") {
  if (scope === "daily") {
    const d = period === "current" ? ymd() : prevYmd(ymd());
    return { label: d, art: `lb:art:daily:${d}` };
  } else {
    const w = period === "current" ? isoWeek() : prevIsoWeek(isoWeek());
    return { label: w, art: `lb:art:weekly:${w}` };
  }
}

// normalize handle pemilik (x/discord)
function ownerFromMeta(m: any): string {
  const x = (m?.x || "").toString().trim().replace(/^@/, "");
  if (x) return `@${x.toLowerCase()}`;
  const d = (m?.discord || "").toString().trim().replace(/^@/, "");
  return d ? `@${d.toLowerCase()}` : "";
}

// cek createdAt masuk periode harian/mingguan (pakai offset UTC+7 dari env)
function ymdLocal(dateStr: string) {
  const tzMin = Number(process.env.RESET_TZ_MINUTES ?? 420);
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return null;
  const loc = new Date(t + tzMin * 60000);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${loc.getUTCFullYear()}-${pad(loc.getUTCMonth() + 1)}-${pad(loc.getUTCDate())}`;
}
function isoWeekLocal(dateStr: string) {
  const tzMin = Number(process.env.RESET_TZ_MINUTES ?? 420);
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return null;
  const loc = new Date(t + tzMin * 60000);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const date = new Date(Date.UTC(loc.getUTCFullYear(), loc.getUTCMonth(), loc.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (date.getTime() - firstThu.getTime()) / 86400000;
  const week = 1 + Math.floor(diff / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ scope: string; period: string }> } // <-- sesuai project kamu
) {
  const { scope, period } = await ctx.params; // <-- await params

  if (!["daily", "weekly"].includes(scope) || !["current", "previous"].includes(period)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }

  // Top Art dari ZSET (sesuai yang sudah ada)
  const k = keys(scope as "daily" | "weekly", period as "current" | "previous");
  const artArr = await (kv as any).zrevrange(k.art, 0, 49, { withscores: true });
  const top_art = pairs(artArr);

  // Top Creators = jumlah upload dalam periode
  const metas = await loadAllMetas();
  const counts: Record<string, number> = {};

  if (scope === "daily") {
    for (const m of metas) {
      const o = ownerFromMeta(m);
      if (!o) continue;
      if (ymdLocal(m.createdAt) === k.label) {
        counts[o] = (counts[o] || 0) + 1;
      }
    }
  } else {
    for (const m of metas) {
      const o = ownerFromMeta(m);
      if (!o) continue;
      if (isoWeekLocal(m.createdAt) === k.label) {
        counts[o] = (counts[o] || 0) + 1;
      }
    }
  }

  const top_creators = Object.entries(counts)
    .map(([user, uploads]) => ({ user, uploads }))
    .sort((a, b) => b.uploads - a.uploads)
    .slice(0, 50);

  return NextResponse.json({
    scope,
    period,
    keyDate: k.label,
    top_art,
    top_creators, // uploads-based
  });
}
