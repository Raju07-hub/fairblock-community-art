// lib/user-id.ts
import { cookies } from "next/headers";

const COOKIE_NAME = "fb_uid";
const ONE_YEAR = 60 * 60 * 24 * 365; // seconds

/** Ambil uid dari cookie; null kalau tidak ada */
export function getUserIdFromCookies(): string | null {
  try {
    const c = cookies();
    const v = c.get(COOKIE_NAME)?.value;
    return v ?? null;
  } catch {
    return null;
  }
}

/** Pastikan uid ada di cookie; generate kalau belum ada, lalu kembalikan nilainya */
export function ensureUserIdCookie(): string {
  const c = cookies();
  let v = c.get(COOKIE_NAME)?.value;

  if (!v) {
    // gunakan Web Crypto (tersedia di Edge Runtime)
    const gen =
      (globalThis.crypto && "randomUUID" in globalThis.crypto)
        ? (globalThis.crypto as Crypto).randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    v = gen;
    c.set({
      name: COOKIE_NAME,
      value: v,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: ONE_YEAR,
    });
  }
  return v;
}
