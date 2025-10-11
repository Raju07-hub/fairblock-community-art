export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";

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

const cKey = (id: string) => `likes:count:${id}`;

export async function POST(req: Request) {
  try {
    const adminKeyHdr = req.headers.get("x-admin-key") || "";
    const ADMIN = process.env.ADMIN_KEY || "";
    if (!ADMIN || adminKeyHdr !== ADMIN) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // ambil gallery untuk tahu daftar item & owner
    const g = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/gallery`, { cache: "no-store" })
      .then(r => r.json()).catch(() => ({}));
    const items: Array<{id: string; x?: string; discord?: string}> = g?.items || [];

    // key leaderboard periode sekarang
    const daily = isoDateUTC();
    const weekly = isoWeekUTC();
    const keys = {
      artDaily: `lb:art:daily:${daily}`,
      artWeekly: `lb:art:weekly:${weekly}`,
      creatorDaily: `lb:creator:daily:${daily}`,
      creatorWeekly: `lb:creator:weekly:${weekly}`,
    };

    // clear dulu
    await Promise.all([
      kv.del(keys.artDaily),
      kv.del(keys.artWeekly),
      kv.del(keys.creatorDaily),
      kv.del(keys.creatorWeekly),
    ]);

    // hitung uploads per creator (berdasarkan handle)
    const uploads = new Map<string, number>();
    const handleFrom = (it: any) => {
      const x = (it.x || "").replace(/^@/, "");
      if (x) return `@${x}`;
      const d = (it.discord || "").replace(/^@/, "");
      return d ? `@${d}` : "";
    };

    for (const it of items) {
      const h = handleFrom(it);
      if (h) uploads.set(h, (uploads.get(h) || 0) + 1);
    }

    // update creator zset
    await Promise.all(
      Array.from(uploads.entries()).map(([creator, n]) =>
        Promise.all([
          (kv as any).zincrby(keys.creatorDaily, n, creator),
          (kv as any).zincrby(keys.creatorWeekly, n, creator),
        ])
      )
    );

    // update art zset berdasarkan likes:count:<id>
    for (const it of items) {
      const cnt = (await kv.get<number | null>(cKey(it.id))) ?? 0;
      if (cnt > 0) {
        await Promise.all([
          (kv as any).zincrby(keys.artDaily, cnt, it.id),
          (kv as any).zincrby(keys.artWeekly, cnt, it.id),
        ]);
      }
    }

    return NextResponse.json({ success: true, rebuilt: { items: items.length, creators: uploads.size } });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Rebuild failed" },
      { status: 500 }
    );
  }
}
