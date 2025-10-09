import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies } from "@/lib/user-id";

const cKey = (id: string) => `likes:count:${id}`;
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`;

const Z_ART = "lb:art:all";
const Z_CREATOR = "lb:creator:all";

export async function POST(req: Request) {
  try {
    const { id, author } = await req.json().catch(() => ({}));
    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    const uid = (await getUserIdFromCookies()) || "anon";
    const userFlagKey = uKey(uid, id);

    // ❌ HAPUS generic: kv.get<number|null>()
    // ✅ Gunakan cast:
    const current = (await kv.get(userFlagKey)) as number | null;
    const alreadyLiked = (current ?? 0) > 0;

    let liked: boolean;
    let newCount: number;

    if (!alreadyLiked) {
      const f = await kv.incr(userFlagKey); // 0 -> 1
      liked = f > 0;
      newCount = await kv.incr(cKey(id));   // global +1

      await Promise.all([
        kv.zincrby(Z_ART, 1, id),
        author ? kv.zincrby(Z_CREATOR, 1, author) : Promise.resolve(0),
      ]);
    } else {
      await kv.decr(userFlagKey);           // 1 -> 0
      liked = false;
      newCount = await kv.decr(cKey(id));   // global -1

      await Promise.all([
        kv.zincrby(Z_ART, -1, id),
        author ? kv.zincrby(Z_CREATOR, -1, author) : Promise.resolve(0),
      ]);
    }

    if (newCount < 0) newCount = 0;

    return NextResponse.json({ success: true, liked, count: newCount });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Like failed" }, { status: 500 });
  }
}
