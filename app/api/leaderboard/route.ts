// app/api/leaderboard/route.ts
import { NextResponse } from "next/server";
import kv from "@/lib/kv";

const Z_ART = "lb:art:all";
const Z_CREATOR = "lb:creator:all";

/**
 * GET /api/leaderboard
 * Return top arts & top creators (pakai zrevrange withScores).
 */
export async function GET() {
  try {
    // zrevrange(..., { withScores: true }) → alternating [member, score, member, score, ...]
    const rawArts = (await kv.zrevrange(Z_ART, 0, 19, { withScores: true })) as (string | number)[];
    const topArts: { id: string; score: number }[] = [];
    for (let i = 0; i < rawArts.length; i += 2) {
      topArts.push({ id: String(rawArts[i]), score: Number(rawArts[i + 1]) });
    }

    const rawCreators = (await kv.zrevrange(Z_CREATOR, 0, 19, { withScores: true })) as (string | number)[];
    const topCreators: { creator: string; score: number }[] = [];
    for (let i = 0; i < rawCreators.length; i += 2) {
      topCreators.push({ creator: String(rawCreators[i]), score: Number(rawCreators[i + 1]) });
    }

    return NextResponse.json({ success: true, arts: topArts, creators: topCreators });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "LB failed" }, { status: 500 });
  }
}
