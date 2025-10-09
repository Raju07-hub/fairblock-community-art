// app/api/like/route.ts
export const runtime = "edge";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { cookies } from "next/headers";
import { COOKIE_META } from "@/lib/user-id";

const cKey = (id: string) => `fb:art:${id}:count`;
const seenKey = (id: string) => `fb:art:${id}:seen`;

function keysNow(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const day = Math.floor((+d - +start) / 86400000);
  const week = String(Math.floor((day + start.getUTCDay() + 1) / 7) + 1).padStart(2, "0");
  return {
    artDaily: `fb:lb:art:${y}-${m}-${dd}`,
    artWeekly: `fb:lb:art:${y}-W${week}`,
    artMonthly: `fb:lb:art:${y}-${m}`,
    creatorDaily: `fb:lb:creator:${y}-${m}-${dd}`,
    creatorWeekly: `fb:lb:creator:${y}-W${week}`,
    creatorMonthly: `fb:lb:creator:${y}-${m}`,
  };
}

export async function POST(req: Request) {
  const { id, author } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

  const c = await cookies();
  const uid = c.get(COOKIE_META.name)?.value || "anon";
  const already = await kv.sismember(seenKey(id), uid);

  let liked = false;
  let count = Number((await kv.get<number>(cKey(id))) ?? 0);

  const ks = keysNow();

  if (!already) {
    await kv.sadd(seenKey(id), uid);
    count = await kv.incr(cKey(id));
    liked = true;

    await Promise.all([
      kv.zincrby(ks.artDaily, 1, id),
      kv.zincrby(ks.artWeekly, 1, id),
      kv.zincrby(ks.artMonthly, 1, id),
      author ? kv.zincrby(ks.creatorDaily, 1, author) : Promise.resolve(0),
      author ? kv.zincrby(ks.creatorWeekly, 1, author) : Promise.resolve(0),
      author ? kv.zincrby(ks.creatorMonthly, 1, author) : Promise.resolve(0),
    ]);
  } else {
    await kv.srem(seenKey(id), uid);
    count = await kv.decr(cKey(id));
    liked = false;

    await Promise.all([
      kv.zincrby(ks.artDaily, -1, id),
      kv.zincrby(ks.artWeekly, -1, id),
      kv.zincrby(ks.artMonthly, -1, id),
      author ? kv.zincrby(ks.creatorDaily, -1, author) : Promise.resolve(0),
      author ? kv.zincrby(ks.creatorWeekly, -1, author) : Promise.resolve(0),
      author ? kv.zincrby(ks.creatorMonthly, -1, author) : Promise.resolve(0),
    ]);
  }

  return NextResponse.json({ success: true, liked, count });
}
