// app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";

/** Helper penentu key leaderboard per rentang */
function keyByRange(range: string) {
  const now = new Date();

  if (range === "weekly") {
    // ISO week (UTC)
    const d = new Date();
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7);
    const wk = String(weekNo).padStart(2, "0");
    return {
      art: `lb:weekly:${date.getUTCFullYear()}-W${wk}`,
      creator: `lb:creator:weekly:${date.getUTCFullYear()}-W${wk}`,
    };
  }

  if (range === "monthly") {
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    return {
      art: `lb:monthly:${yyyy}-${mm}`,
      creator: `lb:creator:monthly:${yyyy}-${mm}`,
    };
  }

  // daily (default)
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return {
    art: `lb:daily:${yyyy}-${mm}-${dd}`,
    creator: `lb:creator:daily:${yyyy}-${mm}-${dd}`,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") || "daily").toLowerCase();
  const keys = keyByRange(range);

  // -------- ARTS (Top karya) ----------
  // Upstash: zrange + {rev:true, withScores:true} => [member, score, member, score, ...]
  const rawArts = (await kv.zrange(keys.art, 0, 19, {
    rev: true,
    withScores: true,
  })) as (string | number)[];

  const artsPairs: { id: string; score: number }[] = [];
  for (let i = 0; i < rawArts.length; i += 2) {
    artsPairs.push({ id: String(rawArts[i]), score: Number(rawArts[i + 1]) });
  }

  // Ambil metadata karya dari /api/gallery (biar tidak ubah storage sekarang)
  let metaMap: Record<string, any> = {};
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "";
    const res = await fetch(`${base}/api/gallery`, { cache: "no-store" });
    const j = await res.json();
    if (j?.success && Array.isArray(j.items)) {
      j.items.forEach((it: any) => {
        metaMap[it.id] = it;
      });
    }
  } catch {
    // no-op
  }

  const arts = await Promise.all(
    artsPairs.map(async (a) => {
      const it = metaMap[a.id];
      // sinkronkan dengan counter total jika ada (fallback: skor zset)
      const count = (await kv.get<number>(`likes:count:${a.id}`)) ?? a.score;
      return {
        id: a.id,
        title: it?.title || "(untitled)",
        url: it?.url || "",
        likes: Number(count) || 0,
        author: (it?.x || it?.discord || "")?.replace(/^@/, ""),
      };
    })
  );

  // -------- CREATORS (Top creator) ----------
  const rawCreators = (await kv.zrange(keys.creator, 0, 19, {
    rev: true,
    withScores: true,
  })) as (string | number)[];

  const creators: { handle: string; likes: number }[] = [];
  for (let i = 0; i < rawCreators.length; i += 2) {
    const handle = String(rawCreators[i]);
    const likes = Number(rawCreators[i + 1]);
    creators.push({ handle, likes });
  }

  return NextResponse.json({ success: true, arts, creators });
}
