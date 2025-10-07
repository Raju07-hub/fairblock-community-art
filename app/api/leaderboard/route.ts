import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";

/**
 * Helper: tentukan key leaderboard berdasarkan range
 */
function keyByRange(range: string) {
  const now = new Date();

  if (range === "weekly") {
    // ISO week number (UTC)
    const d = new Date();
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
    const wk = `W${String(weekNo).padStart(2, "0")}`;
    return {
      art: `lb:weekly:${date.getUTCFullYear()}-${wk}`,
      creator: `lb:creator:weekly:${date.getUTCFullYear()}-${wk}`,
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

/**
 * Normalisasi output zrange:
 * - Upstash bisa mengembalikan: [member, score, member, score, ...]
 * - atau: [{ member, score }, ...]
 */
function parseZRange(raw: any): { member: string; score: number }[] {
  if (!Array.isArray(raw)) return [];
  // Bentuk object array
  if (raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null && "member" in raw[0]) {
    return raw.map((r: any) => ({ member: String(r.member), score: Number(r.score) }));
  }
  // Bentuk flat array [member, score, ...]
  const out: { member: string; score: number }[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    out.push({ member: String(raw[i]), score: Number(raw[i + 1] ?? 0) });
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") || "daily").toLowerCase();
    const keys = keyByRange(range);

    // -------- ARTS (Top liked artworks) --------
    // pakai zrange + { rev: true, withScores: true } -> setara zrevrange
    const rawArts = await (kv as any).zrange(keys.art, 0, 19, {
      rev: true,
      withScores: true,
    });
    const artsParsed = parseZRange(rawArts);

    // Ambil map metadata art dari /api/gallery
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    let metaMap: Record<string, any> = {};

    try {
      const res = await fetch(`${base}/api/gallery`, { cache: "no-store" });
      const j = await res.json();
      if (j?.success && Array.isArray(j.items)) {
        j.items.forEach((it: any) => {
          metaMap[it.id] = it;
        });
      }
    } catch {
      // diamkan: fallback ke data minimal
    }

    const artsOut = await Promise.all(
      artsParsed.map(async (a) => {
        const it = metaMap[a.member];
        // sinkronkan likes total (fallback ke skor leaderboard)
        const count =
          (await (kv as any).get<number>(`likes:count:${a.member}`)) || a.score;
        return {
          id: a.member,
          title: it?.title || "(untitled)",
          url: it?.url || "",
          likes: count,
          author: (it?.x || it?.discord || "")?.replace(/^@/, ""),
        };
    }));

    // -------- CREATORS (Top creators by likes) --------
    const rawCreators = await (kv as any).zrange(keys.creator, 0, 19, {
      rev: true,
      withScores: true,
    });
    const creatorsParsed = parseZRange(rawCreators);
    const creatorsOut = creatorsParsed.map((c) => ({
      handle: c.member,
      likes: c.score,
    }));

    return NextResponse.json({
      success: true,
      range,
      arts: artsOut,
      creators: creatorsOut,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Leaderboard error" },
      { status: 500 }
    );
  }
}
