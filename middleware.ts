import { NextResponse, NextRequest } from "next/server";

const COOKIE = "fb_uid";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const has = req.cookies.get(COOKIE)?.value;

  if (!has) {
    const uid = crypto.randomUUID();
    res.cookies.set(COOKIE, uid, {
      httpOnly: false,          // boleh diakses client untuk debug ringan
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 5, // 5 tahun
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
