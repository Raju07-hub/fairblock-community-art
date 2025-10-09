// app/api/leaderboard/route.ts
import { NextResponse } from "next/server";
import kv from "@/lib/kv";

/**
 * Key helper – samakan dengan yang dipakai saat LIKE
 * (biarkan nama-namanya persis kalau di file kamu sudah ada).
 */
const keys = {
  art: "lb:art:all",            // zset: artId -> score (total likes)
  creator: "lb:creator:all",    // zset: @creator -> score (total likes)
};

export async function GET() {
  try {
    // -------- TOP ARTS (pakai zrevrange + withScores) ----------
    // Ambil 20 tertinggi: [member1, score1, member2, score2, ...]
    const rawArts = (await kv.zrevrange(keys.art, 0, 19, { withScores: true })) as (string | number)[];
    const arts: { id: string; score: number }[] = [];
    for (let i = 0; i < rawArts.length; i += 2) {
      arts.push({ id: String(rawArts[i]), score: Number(rawArts[i + 1]) });
    }

    // -------- TOP CREATORS ----------
    const rawCreators = (await kv.zrevrange(keys.creator, 0, 19, { withScores: true })) as (string | number)[];
    const creators: { creator: string; score: number }[] = [];
    for (let i = 0; i < rawCreators.length; i += 2) {
      creators.push({ creator: String(rawCreators[i]), score: Number(rawCreators[i + 1]) });
    }

    return NextResponse.json({
      success: true,
      topArts: arts,
      topCreators: creators,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? "Leaderboard fetch failed" },
      { status: 500 }
    );
  }
}
