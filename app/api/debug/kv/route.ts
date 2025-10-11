import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { ymd, isoWeek } from "@/lib/period";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || `lb:art:daily:${ymd()}`;
  // @ts-ignore
  const data = await (kv as any).zrevrange(key, 0, 20, { withscores: true }).catch(()=>null);
  return NextResponse.json({ key, today: ymd(), thisWeek: isoWeek(), data });
}
