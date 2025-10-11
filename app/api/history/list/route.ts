export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";

// ---- helpers ----
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function isoDateUTC(d = new Date()) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function isoWeekUTC(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (date.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.floor(diff / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}
function saturdayOfIsoWeek(key: string) {
  // key like: 2025-W41
  const [yearStr, wStr] = key.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(wStr, 10);
  // ISO week: Thursday-based
  const simple = new Date(Date.UTC(year, 0, 4));
  const dow = (simple.getUTCDay() + 6) % 7; // 0..6, Monday=0
  const thursday = new Date(simple);
  thursday.setUTCDate(simple.getUTCDate() - dow + 3);
  const targetThursday = new Date(thursday);
  targetThursday.setUTCDate(thursday.getUTCDate() + (week - 1) * 7);
  // Saturday of that ISO week:
  const saturday = new Date(targetThursday);
  saturday.setUTCDate(targetThursday.getUTCDate() + 2);
  return `${saturday.getUTCFullYear()}-${pad(saturday.getUTCMonth() + 1)}-${pad(saturday.getUTCDate())}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get("scope") || "daily") as "daily" | "weekly";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "0") || 0, 1), scope === "daily" ? 30 : 26);

    const items: { key: string; label: string; display: string }[] = [];

    if (scope === "daily") {
      let d = new Date();
      for (let i = 0; i < limit; i++) {
        const keyDate = isoDateUTC(d);
        const zkey = `lb:art:daily:${keyDate}`;
        const rows = (await (kv as any).zrevrange(zkey, 0, 0)) as any[];
        if (rows && rows.length > 0) {
          items.push({
            key: keyDate,
            label: keyDate,
            display: keyDate,
          });
        }
        d = new Date(d.getTime() - 86400000);
      }
    } else {
      // weekly (26 latest weeks)
      let d = new Date();
      for (let i = 0; i < limit; i++) {
        const wkey = isoWeekUTC(d);
        const zkey = `lb:art:weekly:${wkey}`;
        const rows = (await (kv as any).zrevrange(zkey, 0, 0)) as any[];
        if (rows && rows.length > 0) {
          const sat = saturdayOfIsoWeek(wkey);
          items.push({
            key: wkey,
            label: wkey,
            display: `Week ${wkey} (Sat ${sat})`,
          });
        }
        d = new Date(d.getTime() - 7 * 86400000);
      }
    }

    return NextResponse.json({ success: true, scope, items });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Failed to list history" }, { status: 500 });
  }
}
