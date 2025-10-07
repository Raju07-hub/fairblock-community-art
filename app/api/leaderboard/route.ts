// app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";

function keyByRange(range: string) {
  const now = new Date();

  if (range === "weekly") {
    const d = new Date();
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7);

    return {
      art: `lb:weekly:${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`,
      creator: `lb:creator:weekly:${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`,
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
  // withScores: true -> array seperti [member1, score1, member2, score2, ...]
  const rawArts = (await kv.zrevrange(keys.art, 0, 19, {
    withScores: true,
  })) as (string | number)[];

  const artPairs: { member: string; score: number }[] = [];
  for (let i = 0; i < rawArts.length; i += 2) {
    artPairs.push({
      member: String(rawArts[i]),
      score: Number(rawArts[i + 1]),
    });
  }

  // ambil metadata dari /api/gallery supaya tidak ubah struktur storage
  let metaMap: Record<string, any> = {};
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "";
    const res = await fetch(`${base}/api/gallery`, { cache: "no-store" });
    const j = await res.json();
    if (j?.success && Array.isArray(j.items)) {
      j.items.forEach((it: any) => (metaMap[it.id] = it));
    }
  } catch {
    /* ignore */
  }

  const artsOut = await Promise.all(
    artPairs.map(async (a) => {
      // total likes by doc (fallback ke skor leaderboard kalau key tidak ada)
      const countRaw = await kv.get<number>(`likes:count:${a.member}`);
      const count = typeof countRaw === "number" ? countRaw : a.score;

      const it = metaMap[a.member];
      return {
        id: a.member,
        title: it?.title || "(untitled)",
        url: it?.url || "",
        likes: count,
        author: (it?.x || it?.discord || "")?.replace(/^@/, ""),
      };
    })
  );

  // -------- CREATORS (Top creator) ----------
  const rawCreators = (await kv.zrevrange(keys.creator, 0, 19, {
    withScores: true,
  })) as (string | number)[];

  const creatorsOut: { handle: string; likes: number }[] = [];
  for (let i = 0; i < rawCreators.length; i += 2) {
    creatorsOut.push({
      handle: String(rawCreators[i]),
      likes: Number(rawCreators[i + 1]),
    });
  }

  return NextResponse.json({ success: true, arts: artsOut, creators: creatorsOut });
}
