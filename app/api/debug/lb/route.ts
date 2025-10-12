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

export async function GET() {
  const wArtKey = `lb:art:weekly:${weekSatUTC()}`;
  const mArtKey = `lb:art:monthly:${ym()}`;

  const [wA, mA] = await Promise.all([
    (kv as any).zrevrange(wArtKey, 0, 50, { withscores: true }),
    (kv as any).zrevrange(mArtKey, 0, 50, { withscores: true }),
  ]);

  return NextResponse.json({
    weekKeyArt: wArtKey,
    monthKeyArt: mArtKey,
    weeklyArt: toPairs(wA || []),
    monthlyArt: toPairs(mA || []),
  });
}
