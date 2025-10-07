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
  // daily default
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

  // ---------- ARTS ----------
  const rawArts = await kv.zrevrange<string[]>(keys.art, 0, 19, { withScores: true });
  const arts: { id: string; score: number }[] = [];
  for (let i = 0; i < rawArts.length; i += 2) {
    arts.push({ id: String(rawArts[i]), score: Number(rawArts[i + 1]) });
  }

  // Ambil metadata art dari /api/gallery agar tidak ubah storage
  let map: Record<string, any> = {};
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/gallery`, { cache: "no-store" });
    const j = await res.json();
    if (j?.success && Array.isArray(j.items)) {
      j.items.forEach((it: any) => {
        map[it.id] = it;
      });
    }
  } catch {}

  const artsOut = await Promise.all(
    arts.map(async (a) => {
      const it = map[a.id];
      const count = (await kv.get<number>(`likes:count:${a.id}`)) || a.score;
      return {
        id: a.id,
        title: it?.title || "(untitled)",
        url: it?.url || "",
        likes: count,
        author: (it?.x || it?.discord || "")?.replace(/^@/, ""),
      };
    })
  );

  // ---------- CREATORS ----------
  const rawCreators = await kv.zrevrange<string[]>(keys.creator, 0, 19, { withScores: true });
  const creatorsOut: { handle: string; likes: number }[] = [];
  for (let i = 0; i < rawCreators.length; i += 2) {
    const handle = String(rawCreators[i]);
    const likes = Number(rawCreators[i + 1]);
    creatorsOut.push({ handle, likes });
  }

  return NextResponse.json({ success: true, arts: artsOut, creators: creatorsOut });
}
