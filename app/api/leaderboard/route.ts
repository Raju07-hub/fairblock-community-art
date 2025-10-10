// app/api/leaderboard/route.ts
import { NextResponse } from "next/server";
import kv from "@/lib/kv";

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function isoDateUTC(d = new Date()) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Weekly key with week starting Saturday 00:00 UTC */
function weekKey_SaturdayUTC(d = new Date()) {
  const DAY = 86400000;
  const WEEK = DAY * 7;

  // find this week's Saturday 00:00 UTC (backwards)
  const todayMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0);
  const day = new Date(todayMidnight).getUTCDay(); // 0..6
  const deltaToSat = (day - 6 + 7) % 7;
  const weekStart = new Date(todayMidnight - deltaToSat * DAY); // Saturday 00:00 UTC

  // find first Saturday of that year
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("range") || searchParams.get("period") || "daily").toLowerCase();
  const period: "daily" | "weekly" = q === "weekly" ? "weekly" : "daily";
  const keys = zkey(period);

  try {
    const rawArts = (await (kv as any).zrange(keys.art, 0, 9, { rev: true, withScores: true }))
      as Array<{ member: string; score: number }> | (string | number)[];
    const rawCreators = (await (kv as any).zrange(keys.creator, 0, 9, { rev: true, withScores: true }))
      as Array<{ member: string; score: number }> | (string | number)[];

    function normalize(raw: Array<{ member: string; score: number }> | (string | number)[]) {
      if (!Array.isArray(raw) || raw.length === 0) return [] as { member: string; score: number }[];
      if (typeof raw[0] === "object") return raw as Array<{ member: string; score: number }>;
      const out: { member: string; score: number }[] = [];
      for (let i = 0; i < raw.length; i += 2) out.push({ member: String(raw[i]), score: Number(raw[i + 1] || 0) });
      return out;
    }

    const topArts = normalize(rawArts).map((x) => ({ id: x.member, score: x.score }));
    const topCreators = normalize(rawCreators).map((x) => ({ creator: x.member, score: x.score }));

    return NextResponse.json({
      success: true,
      period,
      topArts,
      topCreators,
      // aliases for backward-compat
      arts: topArts,
      creators: topCreators,
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: (e as Error).message,
      period,
      topArts: [],
      topCreators: [],
    });
  }
}
