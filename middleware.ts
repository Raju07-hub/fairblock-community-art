import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function randomId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const has = req.cookies.get("fb_uid")?.value;

  if (!has) {
    res.cookies.set("fb_uid", randomId(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      // 180 hari
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  return res;
}

/** Jalankan untuk semua route (static asset akan di-bypass otomatis) */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
