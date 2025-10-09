// app/api/like/route.ts
import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { cookies } from "next/headers";
import { COOKIE_META } from "@/lib/user-id";

const cKey = (id: string) => `fb:art:${id}:count`;
const seenKey = (id: string) => `fb:art:${id}:seen`;

function makeNowKeys(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  // ISO week (sederhana)
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const day = Math.floor((+d - +tmp) / 86400000);
  const week = String(Math.floor((day + tmp.getUTCDay() + 1) / 7) + 1).padStart(2, "0");

  return {
    artDaily:   `fb:lb:art:${y}-${String(d.getUTCMonth() + 1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`,
    artWeekly:  `fb:lb:art:${y}-W${week}`,
    artMonthly: `fb:lb:art:${y}-${m}`,
    creatorDaily:   `fb:lb:creator:${y}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`,
    creatorWeekly:  `fb:lb:creator:${y}-W${week}`,
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

  if (!already) {
    // like
    await kv.sadd(seenKey(id), uid);
    count = await kv.incr(cKey(id));
    liked = true;

    const keys = makeNowKeys();
    await Promise.all([
      kv.zincrby(keys.artDaily, 1, id),
      kv.zincrby(keys.artWeekly, 1, id),
      kv.zincrby(keys.artMonthly, 1, id),
      author ? kv.zincrby(keys.creatorDaily, 1, author) : Promise.resolve(0),
      author ? kv.zincrby(keys.creatorWeekly, 1, author) : Promise.resolve(0),
      author ? kv.zincrby(keys.creatorMonthly, 1, author) : Promise.resolve(0),
    ]);
  } else {
    // unlike (toggle)
    await kv.srem(seenKey(id), uid);
    count = await kv.decr(cKey(id));
    liked = false;

    const keys = makeNowKeys();
    await Promise.all([
      kv.zincrby(keys.artDaily, -1, id),
      kv.zincrby(keys.artWeekly, -1, id),
      kv.zincrby(keys.artMonthly, -1, id),
      author ? kv.zincrby(keys.creatorDaily, -1, author) : Promise.resolve(0),
      author ? kv.zincrby(keys.creatorWeekly, -1, author) : Promise.resolve(0),
      author ? kv.zincrby(keys.creatorMonthly, -1, author) : Promise.resolve(0),
    ]);
  }

  return NextResponse.json({ success: true, liked, count });
}
