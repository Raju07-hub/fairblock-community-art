import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies, ensureUserIdCookie } from "@/lib/user-id";
import { ymd, isoWeek } from "@/lib/period";

const cKey = (id: string) => `likes:count:${id}`;
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`;

// Periode terakhir saat user LIKE (untuk rollback UNLIKE yang lintas hari/minggu)
const lastDailyKey = (uid: string, id: string) => `likes:lastDaily:${uid}:${id}`;
const lastWeeklyKey = (uid: string, id: string) => `likes:lastWeekly:${uid}:${id}`;

function lbKeys(day: string, week: string) {
  return {
    artDaily:     `lb:art:daily:${day}`,
    artWeekly:    `lb:art:weekly:${week}`,
    creatorDaily: `lb:creator:daily:${day}`,
    creatorWeekly:`lb:creator:weekly:${week}`,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const author = String(body?.author || "");
  if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

  const res = new NextResponse();
  let uid = await getUserIdFromCookies();
  if (!uid) uid = await ensureUserIdCookie(res);

  const userFlagKey = uKey(uid!, id);
  const alreadyLiked = ((await kv.get<number | null>(userFlagKey)) ?? 0) > 0;

  const day = ymd();
  const week = isoWeek();

  let liked: boolean;
  let count: number;

  if (alreadyLiked) {
    // UNLIKE → rollback ke periode LIKE sebelumnya
    const curCount = (await kv.get<number | null>(cKey(id))) ?? 0;
    count = curCount > 0 ? await kv.decr(cKey(id)) : 0;
    await kv.decr(userFlagKey);
    liked = false;

    const lastDay = (await kv.get<string | null>(lastDailyKey(uid!, id))) || day;
    const lastWeek = (await kv.get<string | null>(lastWeeklyKey(uid!, id))) || week;
    const back = lbKeys(lastDay, lastWeek);

    if (author) {
      await Promise.all([
        (kv as any).zincrby(back.artDaily, -1, id),
        (kv as any).zincrby(back.artWeekly, -1, id),
        (kv as any).zincrby(back.creatorDaily, -1, author),
        (kv as any).zincrby(back.creatorWeekly, -1, author),
      ]);
    }
    await Promise.all([
      kv.del(lastDailyKey(uid!, id)),
      kv.del(lastWeeklyKey(uid!, id)),
    ]);
  } else {
    // LIKE
    count = await kv.incr(cKey(id));
    await kv.incr(userFlagKey);
    liked = true;

    const fwd = lbKeys(day, week);
    if (author) {
      await Promise.all([
        (kv as any).zincrby(fwd.artDaily, 1, id),
        (kv as any).zincrby(fwd.artWeekly, 1, id),
        (kv as any).zincrby(fwd.creatorDaily, 1, author),
        (kv as any).zincrby(fwd.creatorWeekly, 1, author),
      ]);
    }
    await Promise.all([
      kv.set(lastDailyKey(uid!, id), day),
      kv.set(lastWeeklyKey(uid!, id), week),
    ]);
  }

  return NextResponse.json({ success: true, liked, count }, { headers: res.headers });
}
