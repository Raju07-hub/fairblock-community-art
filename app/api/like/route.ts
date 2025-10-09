// app/api/like/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserIdFromCookies, ensureUserIdCookie } from "@/lib/user-id";

const cKey = (id: string) => `likes:count:${id}`;
const uKey = (uid: string, id: string) => `likes:user:${uid}:${id}`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const author = String(body?.author || "");

  if (!id) {
    return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
  }

  // kita butuh response utk menyisipkan cookie bila belum ada
  const res = new NextResponse();

  // pastikan user punya UID cookie
  let uid = await getUserIdFromCookies();
  if (!uid) {
    uid = await ensureUserIdCookie(res); // men-SET cookie di 'res'
  }

  const userFlagKey = uKey(uid!, id);

  // apakah user sudah like?
  const current = await kv.get<number | null>(userFlagKey);
  const alreadyLiked = (current ?? 0) > 0;

  let liked: boolean;
  let count: number;

  if (alreadyLiked) {
    // UNLIKE — jaga agar count tidak negatif
    const curCount = (await kv.get<number | null>(cKey(id))) ?? 0;
    if (curCount > 0) {
      count = await kv.decr(cKey(id)); // turunkan di KV
    } else {
      count = 0; // jangan negatif
    }
    await kv.decr(userFlagKey);
    liked = false;
  } else {
    // LIKE
    count = await kv.incr(cKey(id)); // naikkan di KV
    await kv.incr(userFlagKey);
    liked = true;
  }

  // kirim JSON + bawa header dari 'res' (supaya set-cookie terkirim)
  return NextResponse.json(
    { success: true, liked, count, author },
    { headers: res.headers }
  );
}
