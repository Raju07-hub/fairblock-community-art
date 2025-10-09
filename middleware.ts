// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureUserIdCookie, getUserIdFromCookies } from "@/lib/user-id";

export async function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  const uid = await getUserIdFromCookies();
  if (!uid) await ensureUserIdCookie(res);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
