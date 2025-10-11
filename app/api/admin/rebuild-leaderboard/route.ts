export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";

function pad(n:number){ return n<10?`0${n}`:`${n}`; }
function isoDateUTC(d = new Date()){
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
}
function isoWeekUTC(d = new Date()){
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay()+6)%7;
  date.setUTCDate(date.getUTCDate()-dayNum+3);
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (date.getTime()-firstThu.getTime())/86400000;
  const week = 1 + Math.floor(diff/7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

export async function POST(req: Request) {
  const adminKey = req.headers.get("x-admin-key");
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dailyKey = `lb:art:daily:${isoDateUTC()}`;
  const weeklyKey = `lb:art:weekly:${isoWeekUTC()}`;

  await Promise.all([
    (kv as any).del(dailyKey).catch(()=>{}),
    (kv as any).del(weeklyKey).catch(()=>{}),
  ]);

  let updated = 0;
  const client: any = kv as any;
  let cursor = "0";
  do {
    const res = await client.scan(cursor, { match: "likes:count:*", count: 500 });
    cursor = res[0];
    const keys: string[] = res[1] || [];
    if (keys.length) {
      const vals = await kv.mget(...keys);
      for (let i=0;i<keys.length;i++){
        const count = Number(vals[i] ?? 0);
        const artId = keys[i].replace("likes:count:","");
        if (!artId || count <= 0) continue;
        await Promise.all([
          (kv as any).zincrby(dailyKey, count, artId),
          (kv as any).zincrby(weeklyKey, count, artId),
        ]);
        updated++;
      }
    }
  } while (cursor !== "0");

  return NextResponse.json({ ok: true, updated, dailyKey, weeklyKey });
}
