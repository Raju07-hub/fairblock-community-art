export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";

async function deleteByPattern(pattern: string) {
  const client: any = kv as any;
  let cursor = "0";
  let removed = 0;
  do {
    const res = await client.scan(cursor, { match: pattern, count: 500 });
    cursor = res[0];
    const keys: string[] = res[1] || [];
    if (keys.length) {
      await client.del(...keys).catch(()=>{});
      removed += keys.length;
    }
  } while (cursor !== "0");
  return removed;
}

export async function POST(req: Request) {
  const adminKey = req.headers.get("x-admin-key");
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const removed = {
    likeCounts: await deleteByPattern("likes:count:*"),
    userFlags: await deleteByPattern("likes:user:*"),
    lbArtDaily: await deleteByPattern("lb:art:daily:*"),
    lbArtWeekly: await deleteByPattern("lb:art:weekly:*"),
    lbCreatorDaily: await deleteByPattern("lb:creator:daily:*"),
    lbCreatorWeekly: await deleteByPattern("lb:creator:weekly:*"),
  };

  return NextResponse.json({ ok: true, removed });
}
