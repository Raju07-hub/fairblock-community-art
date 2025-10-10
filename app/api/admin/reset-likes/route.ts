// app/api/admin/reset-likes/route.ts
import { NextResponse } from "next/server";
import kv from "@/lib/kv";

const ADMIN_KEY = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY;

async function scanDel(pattern: string) {
  const client = kv as any;
  let cursor = 0;
  let removed = 0;
  do {
    const res = await client.scan(cursor, { match: pattern, count: 300 });
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

  let removed = 0;

  // 1) broad sweep
  const broad = [
    "like:*",
    "likes:*",
    "lb:art:daily:*",
    "lb:art:weekly:*",
    "lb:creator:daily:*",
    "lb:creator:weekly:*",
  ];
  for (const p of broad) removed += await scanDel(p);

  // 2) per-ID sweep (jaga-jaga)
  try {
    const resp = await fetch(new URL("/api/gallery", req.url), { cache: "no-store" });
    const j = await resp.json().catch(() => ({}));
    const items: Array<{ id: string }> = j?.items ?? [];
    for (const it of items) {
      const id = it.id;
      for (const p of [`like:*${id}*`, `likes:*${id}*`, `who:*${id}*`, `heart:*${id}*`]) {
        removed += await scanDel(p);
      }
    }
  } catch {}

  return NextResponse.json({ success: true, removed });
}
