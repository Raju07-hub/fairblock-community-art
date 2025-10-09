// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE_META, generateUid } from "@/lib/user-id";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const exists = req.cookies.get(COOKIE_META.name)?.value;
  if (!exists) {
    res.cookies.set(COOKIE_META.name, generateUid(), {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: true,
      maxAge: COOKIE_META.maxAge,
    });
  }
  return res;
}

// exclude asset routes
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp)).*)",
  ],
};
