// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureUserIdCookie } from "@/lib/user-id";

export async function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  await ensureUserIdCookie(res);
  return res;
}

// lewati _next & file statis
export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
