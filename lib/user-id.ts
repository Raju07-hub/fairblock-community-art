// lib/user-id.ts
import { cookies } from "next/headers";

const COOKIE_NAME = "fb_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function getUserIdFromCookies(): string | null {
  try {
    const c = cookies();
    const v = c.get(COOKIE_NAME)?.value;
    return v ?? null;
  } catch {
    return null;
  }
}

export function ensureUserIdCookie(): string {
  try {
    const c = cookies();
    let v = c.get(COOKIE_NAME)?.value;
    if (!v) {
      // gunakan Web Crypto yang tersedia di Edge Runtime
      const rnd =
        globalThis.crypto?.randomUUID?.() ??
        Math.random().toString(36).slice(2);
      v = `${rnd}-${Date.now().toString(36)}`;
      c.set({
        name: COOKIE_NAME,
        value: v,
        httpOnly: false, // boleh dibaca client (untuk debug), kalau mau strict set true
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: ONE_YEAR,
      });
    }
    return v;
  } catch {
    // fallback kalau cookies() error
    return Math.random().toString(36).slice(2);
  }
}
