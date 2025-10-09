// app/api/like/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies, ensureUserIdCookie } from "@/lib/user-id";

// ============================
// Helpers
// ============================
const cKey = (id: string) => `likes:count:${id}`;
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`;

// Helper waktu
function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
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

function leaderboardKeys() {
  const daily = isoDateUTC();
  const weekly = isoWeekUTC();
  return {
    artDaily: `lb:art:daily:${daily}`,
    artWeekly: `lb:art:weekly:${weekly}`,
    creatorDaily: `lb:creator:daily:${daily}`,
    creatorWeekly: `lb:creator:weekly:${weekly}`,
  };
}

// ============================
// Route
// ============================
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const author = String(body?.author || "");

  if (!id) {
    return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
  }

  // Response untuk set-cookie
  const res = new NextResponse();
  let uid = await getUserIdFromCookies();
  if (!uid) uid = await ensureUserIdCookie(res);

  const userFlagKey = uKey(uid!, id);
  const current = await kv.get<number | null>(userFlagKey);
  const alreadyLiked = (current ?? 0) > 0;

  let liked: boolean;
  let count: number;

  const keys = leaderboardKeys();

  if (alreadyLiked) {
    // UNLIKE
    const curCount = (await kv.get<number | null>(cKey(id))) ?? 0;
    if (curCount > 0) {
      count = await kv.decr(cKey(id));
    } else {
      count = 0;
    }
    await kv.decr(userFlagKey);
    liked = false;

    // Turunkan skor di leaderboard
    if (author) {
      await Promise.all([
        (kv as any).zincrby(keys.artDaily, -1, id),
        (kv as any).zincrby(keys.artWeekly, -1, id),
        (kv as any).zincrby(keys.creatorDaily, -1, author),
        (kv as any).zincrby(keys.creatorWeekly, -1, author),
      ]);
    }
  } else {
    // LIKE
    count = await kv.incr(cKey(id));
    await kv.incr(userFlagKey);
    liked = true;

    // Tambahkan ke leaderboard
    if (author) {
      await Promise.all([
        (kv as any).zincrby(keys.artDaily, 1, id),
        (kv as any).zincrby(keys.artWeekly, 1, id),
        (kv as any).zincrby(keys.creatorDaily, 1, author),
        (kv as any).zincrby(keys.creatorWeekly, 1, author),
      ]);
    }
  }

  return NextResponse.json(
    { success: true, liked, count },
    { headers: res.headers }
  );
}
