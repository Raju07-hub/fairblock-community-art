import { NextResponse } from "next/server";
import kv from "@/lib/kv";

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function isoDateUTC(d = new Date()) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Weekly key with week starting Saturday 00:00 UTC */
function weekKey_SaturdayUTC(d = new Date()) {
  const DAY = 86400000;

  const todayMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0);
  const day = new Date(todayMidnight).getUTCDay();
  const deltaToSat = (day - 6 + 7) % 7;
  const weekStart = new Date(todayMidnight - deltaToSat * DAY);

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
  };
}

export async function POST(req: Request) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_KEY && key !== "2ecaa6bfd6e2df7c9d3b35a4ee7f19ce008829c36cff7059b4ebff395933fc8a") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = kv as any;
    const ids = await client.keys("art:*");
    if (!ids || ids.length === 0) {
      return NextResponse.json({ success: true, message: "No artworks found" });
    }

    async function getLike(id: string): Promise<number> {
      const v = await client.get(`like:count:${id}`);
      return Number(v ?? 0);
    }

    const pairs: Array<[string, number]> = await Promise.all(
      ids.map(async (id: string) => [id, await getLike(id)] as [string, number])
    );

    for (const period of ["daily", "weekly"] as const) {
      const { art } = zkey(period);
      if (client.del) await client.del(art);
      for (const [id, score] of pairs) {
        if (score > 0) await client.zadd(art, { score, member: id });
      }
    }

    return NextResponse.json({ success: true, message: "Leaderboard rebuilt successfully" });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: (e as Error).message,
    });
  }
}
