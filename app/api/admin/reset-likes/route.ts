import { NextResponse } from "next/server";
import kv from "@/lib/kv";

// Set di Vercel Project Settings → Environment Variables
const ADMIN_KEY = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY;

async function deleteByPattern(pattern: string) {
  const client = kv as any;
  let cursor = 0;
  let removed = 0;

  // Upstash/Vercel KV: SCAN per pattern
  do {
    const res = await client.scan(cursor, { match: pattern, count: 200 });
    // Konsistenkan hasil (Upstash mengembalikan [cursor, keys])
    cursor = Number(res?.[0] ?? res?.cursor ?? 0);
    const keys: string[] = res?.[1] ?? res?.keys ?? [];
    if (keys.length) {
      if (client.unlink) await client.unlink(...keys);
      else await client.del(...keys);
      removed += keys.length;
    }
  } while (cursor !== 0);

  return removed;
}

export async function POST(req: Request) {
  const hdr = req.headers.get("x-admin-key") || "";
  if (!ADMIN_KEY || hdr !== ADMIN_KEY) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Pola kunci umum di project ini — sesuaikan kalau kamu pakai nama lain
  const patterns = [
    "like:count:*",           // counter like per art
    "like:who:*",             // set/record siapa yg sudah like
    "lb:art:daily:*",         // leaderboard art harian (cache hari berjalan)
    "lb:art:weekly:*",        // leaderboard art mingguan
    "lb:creator:daily:*",     // leaderboard creator harian
    "lb:creator:weekly:*",    // leaderboard creator mingguan
  ];

  let total = 0;
  for (const p of patterns) total += await deleteByPattern(p);

  return NextResponse.json({ success: true, removed: total });
}
