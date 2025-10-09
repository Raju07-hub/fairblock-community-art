import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE = "fb_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get(COOKIE)) {
    const id = (globalThis.crypto?.randomUUID?.() ||
      Math.random().toString(36).slice(2)) as string;
    res.cookies.set(COOKIE, id, { path: "/", maxAge: ONE_YEAR, httpOnly: false });
  }
  return res;
}

// aktifkan di semua route app
export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp)).*)"],
};
