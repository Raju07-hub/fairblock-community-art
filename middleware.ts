import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureUserId, attachUserIdCookie } from "@/lib/user-id";

export async function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  const uid = await ensureUserId();
  attachUserIdCookie(res, uid);
  return res;
}
