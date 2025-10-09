// app/api/leaderboard/route.ts
import { NextResponse } from "next/server";
import kv from "@/lib/kv";

// key ZSET (pastikan sama dengan yang kamu pakai waktu zincrby di /api/like)
const Z_ART = "lb:art";
const Z_CREATOR = "lb:creator";

type TopItem = { id: string; score: number };

async function safeZTop(key: string, limit = 20): Promise<TopItem[]> {
  // Prefer zrange(..., { rev:true, withScores:true }), fallback ke zrevrange
  // Pakai "any" supaya tidak keganjal tipe di environment yang beda-beda
  const client: any = kv as any;

  let raw: Array<string | number> = [];
  if (typeof client.zrange === "function") {
    // zrange dengan {rev:true, withScores:true} mengembalikan array alternating: [member, score, member, score, ...]
    raw = (await client.zrange(key, 0, Math.max(0, limit - 1), {
      rev: true,
      withScores: true,
    })) as Array<string | number>;
  } else if (typeof client.zrevrange === "function") {
    raw = (await client.zrevrange(key, 0, Math.max(0, limit - 1), {
      withScores: true,
    })) as Array<string | number>;
  } else {
    // tidak ada API zrange/zrevrange: kosongin aja
    return [];
  }

  const out: TopItem[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    out.push({ id: String(raw[i]), score: Number(raw[i + 1] ?? 0) });
  }
  return out;
}

export async function GET() {
  try {
    const [arts, creators] = await Promise.all([
      safeZTop(Z_ART, 20),
      safeZTop(Z_CREATOR, 20),
    ]);

    return NextResponse.json({
      success: true,
      arts,
      creators,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "leaderboard failed" },
      { status: 500 }
    );
  }
}
