// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureUserIdCookie } from "@/lib/user-id";

export function middleware(_req: NextRequest) {
  // pastikan user_id cookie ada
  ensureUserIdCookie();
  return NextResponse.next();
}

// exclude asset routes
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
