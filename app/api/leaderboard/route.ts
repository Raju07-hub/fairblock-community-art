// app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";

/** helper weekly key */
function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as unknown as number) - (yearStart as unknown as number)) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function keyByRange(range: string) {
  const now = new Date();
  if (range === "weekly") {
    const wk = isoWeekKey(now);
    return { art: `lb:weekly:${wk}`, creator: `lb:creator:weekly:${wk}` };
  }
  if (range === "monthly") {
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    return { art: `lb:monthly:${yyyy}-${mm}`, creator: `lb:creator:monthly:${yyyy}-${mm}` };
  }
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return { art: `lb:daily:${yyyy}-${mm}-${dd}`, creator: `lb:creator:daily:${yyyy}-${mm}-${dd}` };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") || "daily").toLowerCase();
  const keys = keyByRange(range);

  // -------- ARTS ----------
  // ganti zrevrange -> zrange(..., { rev: true, withScores: true })
  const rawArts = (await kv.zrange(keys.art, 0, 19, {
    rev: true,
    withScores: true,
  })) as (string | number)[];
  const arts: { id: string; score: number }[] = [];
  for (let i = 0; i < rawArts.length; i += 2) {
    arts.push({ id: String(rawArts[i]), score: Number(rawArts[i + 1]) });
  }

  // ambil meta gallery pakai origin dari request (aman di vercel)
  let map: Record<string, any> = {};
  try {
    const origin = req.nextUrl.origin;
    const res = await fetch(`${origin}/api/gallery`, { cache: "no-store" });
    const j = await res.json();
    if (j?.success && Array.isArray(j.items)) {
      j.items.forEach((it: any) => (map[it.id] = it));
    }
  } catch {}

  const artsOut = await Promise.all(
    arts.map(async (a) => {
      const it = map[a.id];
      const cnt = await kv.get<string | number>(`likes:count:${a.id}`);
      return {
        id: a.id,
        title: it?.title || "(untitled)",
        url: it?.url || "",
        likes: Number(cnt ?? a.score),
        author: (it?.x || it?.discord || "")?.replace(/^@/, ""),
      };
    })
  );

  // -------- CREATORS ----------
  const rawCreators = (await kv.zrange(keys.creator, 0, 19, {
    rev: true,
    withScores: true,
  })) as (string | number)[];
  const creatorsOut: { handle: string; likes: number }[] = [];
  for (let i = 0; i < rawCreators.length; i += 2) {
    creatorsOut.push({ handle: String(rawCreators[i]), likes: Number(rawCreators[i + 1]) });
  }

  return NextResponse.json({ success: true, arts: artsOut, creators: creatorsOut });
}
