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
  const weekKey = `lb:art:weekly:${weekSatUTC()}`;
  const monthKey = `lb:art:monthly:${ym()}`;

  const [w, m] = await Promise.all([
    (kv as any).zrevrange(weekKey, 0, 50, { withscores: true }),
    (kv as any).zrevrange(monthKey, 0, 50, { withscores: true }),
  ]);

  return NextResponse.json({
    weekKey, monthKey,
    weekly: toPairs(w || []),
    monthly: toPairs(m || []),
  });
}
