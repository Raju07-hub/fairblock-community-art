// lib/user-id.ts
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE_NAME = "fb_uid";

/**
 * Ambil userId unik dari cookies (jika ada)
 */
export function getUserIdFromCookies(): string | null {
  try {
    const c = cookies();
    const v = c.get(COOKIE_NAME)?.value;
    return v || null;
  } catch {
    return null;
  }
}

/**
 * Pastikan userId cookie ada.
 * Jika belum ada, generate baru dan set cookie.
 * Mengembalikan nilai userId (selalu pasti ada setelah dipanggil)
 */
export function ensureUserIdCookie(): string {
  try {
    const c = cookies();
    const existing = c.get(COOKIE_NAME)?.value;
    if (existing) return existing;

    const newId = randomUUID();
    // Set cookie dengan umur 1 tahun
    c.set({
      name: COOKIE_NAME,
      value: newId,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
      sameSite: "lax",
    });
    return newId;
  } catch {
    const fallback = randomUUID();
    return fallback;
  }
}
