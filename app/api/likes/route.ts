import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";

function today() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function thisMonth() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}
function thisWeek() {
  const d = new Date();
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date as any) - (yearStart as any)) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Ambil creator untuk artId, cache di KV */
async function getCreatorFor(artId: string): Promise<string> {
  const cacheKey = `art:creator:${artId}`;
  let creator = (await kv.get<string>(cacheKey)) || "";

  if (creator) return creator;

  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "";
    const res = await fetch(`${base}/api/gallery`, { cache: "no-store" });
    const j = await res.json();
    const it = j?.items?.find((x: any) => x.id === artId);
    if (!it) return "";

    creator = String(it.x || it.discord || "").trim();
    if (creator.startsWith("@")) creator = creator.slice(1);

    if (creator) {
      // cache 7 hari
      await kv.set(cacheKey, creator, { ex: 60 * 60 * 24 * 7 });
    }
    return creator || "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artId = searchParams.get("id");
  const userId = searchParams.get("user");
  if (!artId) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

  const count = (await kv.get<number>(`likes:count:${artId}`)) || 0;
  let liked = false;
  if (userId) liked = Boolean(await kv.sismember(`likes:set:${artId}`, userId));
  return NextResponse.json({ success: true, count, liked });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const artId = body?.artId as string;
  const userId = body?.userId as string;
  if (!artId || !userId) return NextResponse.json({ success: false, error: "Missing artId/userId" }, { status: 400 });

  const setKey = `likes:set:${artId}`;

  // Sudah like? (no-unlike)
  const already = await kv.sismember(setKey, userId);
  if (already) {
    const countExisted = (await kv.get<number>(`likes:count:${artId}`)) || 0;
    return NextResponse.json({ success: true, count: countExisted, liked: true });
  }

  // Like baru
  await kv.sadd(setKey, userId);
  const newCount = await kv.incr(`likes:count:${artId}`);

  // Leaderboard ART
  await kv.zincrby(`lb:daily:${today()}`, 1, artId);
  await kv.zincrby(`lb:weekly:${thisWeek()}`, 1, artId);
  await kv.zincrby(`lb:monthly:${thisMonth()}`, 1, artId);

  // Leaderboard CREATOR
  const creator = await getCreatorFor(artId); // e.g. "0xKanjuro0" atau "someone#1234"
  if (creator) {
    await kv.zincrby(`lb:creator:daily:${today()}`, 1, creator);
    await kv.zincrby(`lb:creator:weekly:${thisWeek()}`, 1, creator);
    await kv.zincrby(`lb:creator:monthly:${thisMonth()}`, 1, creator);
  }

  return NextResponse.json({ success: true, count: newCount, liked: true });
}
