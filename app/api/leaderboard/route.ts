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

    // Ambil ranking top art by likes
    const arr = await (kv as any).zrevrange(key, 0, 99, { withscores: true });
    const pairs = toPairs(arr || []);

    // Join metadata dari gallery agar frontend tidak perlu join manual
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

    // Hitung creator by uploads langsung dari gallery
    const creatorMap = new Map<string, number>();
    for (const g of items) {
      const handle = (g.x || "").trim();
      if (!handle) continue;
      const key = handle.startsWith("@") ? handle : `@${handle}`;
      creatorMap.set(key, (creatorMap.get(key) || 0) + 1);
    }

    const topCreatorsUploads = Array.from(creatorMap.entries())
      .map(([user, uploads]) => ({ user, uploads }))
      .sort((a, b) => b.uploads - a.uploads)
      .slice(0, 20);

    return NextResponse.json({ success: true, topArts, topCreatorsUploads });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "failed" }, { status: 500 });
  }
}
