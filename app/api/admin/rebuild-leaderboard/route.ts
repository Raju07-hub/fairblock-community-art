// app/api/admin/rebuild-leaderboard/route.ts
import { NextResponse } from "next/server";
import kv from "@/lib/kv";

const ADMIN_KEY = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY;

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function isoDateUTC(d = new Date()) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function weekKey_SaturdayUTC(d = new Date()) {
  const DAY = 86400000;
  const WEEK = DAY * 7;
  const todayMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0);
  const day = new Date(todayMidnight).getUTCDay();
  const deltaToSat = (day - 6 + 7) % 7;
  const weekStart = new Date(todayMidnight - deltaToSat * DAY); // Saturday 00:00 UTC

  const weekYear = weekStart.getUTCFullYear();
  const jan1 = new Date(Date.UTC(weekYear, 0, 1));
  const jan1Day = jan1.getUTCDay();
  const offsetToSat = (6 - jan1Day + 7) % 7;
  const firstSaturday = new Date(Date.UTC(weekYear, 0, 1 + offsetToSat));

  const diffDays = Math.floor((weekStart.getTime() - firstSaturday.getTime()) / DAY);
  const weekNum = 1 + Math.floor(diffDays / 7);

  return `${weekYear}-W${pad(weekNum)}`;
}
function zkey(period: "daily" | "weekly") {
  const day = isoDateUTC();
  const week = weekKey_SaturdayUTC();
  const suffix = period === "weekly" ? week : day;
  return {
    art: `lb:art:${period}:${suffix}`,
    creator: `lb:creator:${period}:${suffix}`,
  };
}

export async function POST(req: Request) {
  const hdr = req.headers.get("x-admin-key") || "";
  if (!ADMIN_KEY || hdr !== ADMIN_KEY) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const gRes = await fetch(new URL("/api/gallery", req.url), { cache: "no-store" });
    const gJson = await gRes.json().catch(() => ({}));
    const items: Array<{ id: string }> = gJson?.items ?? [];
    const ids = items.map(i => i.id);

    const client = kv as any;
    const getLike = async (id: string) => Number(await client.get<number>(`like:count:${id}`) || 0);
    const pairs = await Promise.all(ids.map(async id => [id, await getLike(id)] as const));

    for (const period of ["daily", "weekly"] as const) {
      const key = zkey(period).art;
      if (client.del) await client.del(key);
      for (const [id, score] of pairs) {
        if (score > 0) await client.zadd(key, { score, member: id });
      }
    }

    return NextResponse.json({
      success: true,
      updated: pairs.length,
      note: "Rebuilt top art for daily & weekly based on current like counts.",
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Rebuild failed" }, { status: 500 });
  }
}
