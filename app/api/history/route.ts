export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { weekSatUTC, ym, saturdayUTCFromWeekKey, formatDateUTC7 } from "@/lib/period";

type HistoryItem = { key: string; label: string };

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") || "weekly").toLowerCase();

    const setKey =
      range === "weekly" ? "lb:index:weekly" :
      range === "monthly" ? "lb:index:monthly" : "";

    if (!setKey) {
      return NextResponse.json(
        { success: false, error: "range must be 'weekly' or 'monthly'" },
        { status: 400 },
      );
    }

    const items: string[] = (await (kv as any).smembers(setKey)) || [];
    const currentWeek = weekSatUTC();
    const currentMonth = ym();

    const shaped: HistoryItem[] = items
      .filter((k: string) => (range === "weekly" ? k !== currentWeek : k !== currentMonth))
      .map<HistoryItem>((k: string) => {
        if (range === "weekly") {
          const satUTC = saturdayUTCFromWeekKey(k);
          return { key: k, label: formatDateUTC7(satUTC) }; // YYYY-MM-DD (UTC+7)
        }
        return { key: k, label: k }; // YYYY-MM
      })
      .sort((a: HistoryItem, b: HistoryItem) => (a.key < b.key ? 1 : -1));

    return NextResponse.json({ success: true, items: shaped });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "failed" }, { status: 500 });
  }
}
