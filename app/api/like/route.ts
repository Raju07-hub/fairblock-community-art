// /app/api/like/route.ts
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
  const weekNo = Math.ceil(((date as any) - (yearStart as any)) / 86400000 + 1) / 7;
  const weekStr = String(Math.ceil(weekNo)).padStart(2, "0");
  return `${date.getUTCFullYear()}-W${weekStr}`;
}

// Pastikan env KV ada — kalau belum, kasih error jelas
function assertKVEnv() {
  const miss = ["KV_URL", "KV_REST_API_URL", "KV_REST_API_TOKEN"].filter((k) => !process.env[k]);
  if (miss.length) throw new Error("KV env missing: " + miss.join(", "));
}

/** Ambil creator untuk artId, cache di KV */
async function getCreatorFor(artId: string, origin: string): Promise<string> {
  const cacheKey = `art:creator:${artId}`;
  let creator = (await kv.get<string>(cacheKey)) || "";
  if (creator) return creator;

  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || origin || "";
    if (!base) return "";
    const res = await fetch(`${base}/api/gallery`, { cache: "no-store" });
    const j = await res.json();
    const it = j?.items?.find((x: any) => x.id === artId);
    if (!it) return "";

    creator = String(it.x || it.discord || "").trim();
    if (creator.startsWith("@")) creator = creator.slice(1);

    if (creator) {
      await kv.set(cacheKey, creator, { ex: 60 * 60 * 24 * 7 }); // cache 7 hari
    }
    return creator || "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  try {
    assertKVEnv();
    const { searchParams } = new URL(req.url);
    const artId = searchParams.get("id");
    const userId = searchParams.get("user");
    if (!artId) {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    const count = (await kv.get<number>(`likes:count:${artId}`)) || 0;
    let liked = false;
    if (userId) liked = Boolean(await kv.sismember(`likes:set:${artId}`, userId));
    return NextResponse.json({ success: true, count, liked });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    assertKVEnv();

    const body = await req.json().catch(() => ({}));
    const artId = body?.artId as string;
    const userId = body?.userId as string;
    if (!artId || !userId) {
      return NextResponse.json({ success: false, error: "Missing artId/userId" }, { status: 400 });
    }

    const setKey = `likes:set:${artId}`;
    // cegah race condition — hanya INCR jika benar2 baru
    const added = await kv.sadd(setKey, userId);

    if (added === 0) {
      const countExisted = (await kv.get<number>(`likes:count:${artId}`)) || 0;
      return NextResponse.json({ success: true, count: countExisted, liked: true, unchanged: true });
    }

    // like baru → INCR + leaderboard (pipeline)
    const dKey = `lb:daily:${today()}`;
    const wKey = `lb:weekly:${thisWeek()}`;
    const mKey = `lb:monthly:${thisMonth()}`;

    const pipe = kv.pipeline();
    pipe.incr(`likes:count:${artId}`);
    pipe.zincrby(dKey, 1, artId);
    pipe.zincrby(wKey, 1, artId);
    pipe.zincrby(mKey, 1, artId);

    const [newCount] = (await pipe.exec()) as [number];

    // leaderboard creator (opsional)
    const origin = req.nextUrl?.origin ?? "";
    const creator = await getCreatorFor(artId, origin);
    if (creator) {
      const p2 = kv.pipeline();
      p2.zincrby(`lb:creator:daily:${today()}`, 1, creator);
      p2.zincrby(`lb:creator:weekly:${thisWeek()}`, 1, creator);
      p2.zincrby(`lb:creator:monthly:${thisMonth()}`, 1, creator);
      await p2.exec();
    }

    return NextResponse.json({ success: true, count: newCount, liked: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 });
  }
}
