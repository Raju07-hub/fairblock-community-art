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

async function zTopWithScores(key: string, start = 0, stop = 50) {
  const anyKv = kv as any;
  if (typeof anyKv.zrevrange === "function") {
    return await anyKv.zrevrange(key, start, stop, { withscores: true });
  }
  return await anyKv.zrange(key, start, stop, { rev: true, withScores: true });
}

export async function GET() {
  const wKey = `lb:art:weekly:${weekSatUTC()}`;
  const mKey = `lb:art:monthly:${ym()}`;

  const [w, m] = await Promise.all([zTopWithScores(wKey), zTopWithScores(mKey)]);
  return NextResponse.json({
    weekKey: wKey,
    monthKey: mKey,
    weeklyArt: toPairs(w || []),
    monthlyArt: toPairs(m || []),
  });
}
