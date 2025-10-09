// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureUserCookie } from "@/lib/user-id";

export function middleware(_req: NextRequest) {
  // pasang cookie identitas jika belum ada
  ensureUserCookie();
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
