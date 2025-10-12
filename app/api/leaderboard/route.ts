// app/api/leaderboard/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { weekSatUTC, ym } from "@/lib/period";

function headerNoStore() {
  return {
    "cache-control": "no-store, no-cache, must-revalidate",
    pragma: "no-cache",
    "surrogate-control": "no-store",
    "x-accel-expires": "0",
  };
}

function toPairs(a: any[]) {
  const out: { id: string; score: number }[] = [];
  for (let i = 0; i < a.length; i += 2) {
    out.push({ id: String(a[i]), score: Number(a[i + 1]) });
  }
  return out;
}

// gunakan zrange { rev:true, withScores:true } agar konsisten di Upstash
async function zTopWithScores(key: string, start = 0, stop = 99) {
  const anyKv = kv as any;
  if (typeof anyKv.zrange !== "function") {
    throw new Error("kv.zrange not available");
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
      return NextResponse.json(
        { success: false, error: "range must be 'weekly' or 'monthly'" },
        { status: 400, headers: headerNoStore() }
      );
    }

    const arr = await zTopWithScores(key, 0, 99);
    const pairs = toPairs(arr || []);

    // join metadata gallery
    const gRes = await fetch(new URL("/api/gallery", req.url), { cache: "no-store" }).catch(() => null);
    const gJson = (await gRes?.json().catch(() => null)) as any;
    const items: any[] = gJson?.items || [];
    const map = new Map(items.map((i) => [String(i.id), i]));

    const topArts = pairs.map((p) => {
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

    return NextResponse.json({ success: true, topArts }, { headers: headerNoStore() });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "failed" },
      { status: 500, headers: headerNoStore() }
    );
  }
}
