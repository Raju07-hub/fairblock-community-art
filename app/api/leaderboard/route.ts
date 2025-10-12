export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { weekSatUTC, ym } from "@/lib/period";

function toPairs(a: any[]) {
  const out: { id: string; score: number }[] = [];
  for (let i = 0; i < a.length; i += 2) out.push({ id: String(a[i]), score: Number(a[i + 1]) });
  return out;
}

// Compat helper: pakai zrevrange kalau tersedia; kalau tidak, fallback ke zrange(..., { rev: true })
async function zTopWithScores(key: string, start = 0, stop = 99) {
  const anyKv = kv as any;
  if (typeof anyKv.zrevrange === "function") {
    return await anyKv.zrevrange(key, start, stop, { withscores: true });
  }
  return await anyKv.zrange(key, start, stop, { rev: true, withScores: true });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") || "weekly").toLowerCase(); // weekly | monthly

    const key =
      range === "weekly"
        ? `lb:art:weekly:${weekSatUTC()}`
        : range === "monthly"
        ? `lb:art:monthly:${ym()}`
        : null;

    if (!key) {
      return NextResponse.json({ success: false, error: "range must be 'weekly' or 'monthly'" }, { status: 400 });
    }

    // Ambil ranking Top Art (by likes)
    const arr = await zTopWithScores(key, 0, 99);
    const pairs = toPairs(arr || []);

    // Join metadata gallery
    const gRes = await fetch(new URL("/api/gallery", req.url), { cache: "no-store" }).catch(() => null);
    const gJson = (await gRes?.json().catch(() => null)) as any;
    const items: any[] = gJson?.items || [];
    const map = new Map(items.map(i => [String(i.id), i]));

    const topArts = pairs.map(p => {
      const g = map.get(p.id);
      return {
        id: p.id,
        likes: p.score,
        title: g?.title || "Untitled",
        url: g?.url || "",
        owner: g?.x || "",
        discord: g?.discord || "",
        postUrl: g?.postUrl || "",
      };
    });

    return NextResponse.json({ success: true, topArts });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "failed" }, { status: 500 });
  }
}
