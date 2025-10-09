import { NextRequest } from "next/server";

/** Ambil anon user id dari cookie yang di-set oleh middleware */
export function getUserId(req: NextRequest): string {
  const cookie = req.cookies.get("fb_uid")?.value;
  if (cookie && typeof cookie === "string" && cookie.length >= 16) return cookie;
  // fallback super-aman (hampir tak terjadi jika middleware aktif)
  return "guest-" + Math.random().toString(36).slice(2);
}
