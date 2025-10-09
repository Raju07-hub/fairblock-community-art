// lib/user-id.ts
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE_NAME = "fb_uid";
const MAX_AGE = 60 * 60 * 24 * 365 * 5; // 5 tahun

/** Ambil user id dari cookie; jika belum ada, return null */
export function getUserIdFromCookies(): string | null {
  try {
    const c = cookies();
    return c.get(COOKIE_NAME)?.value || null;
  } catch {
    return null;
  }
}

/** Pastikan cookie user id ada; kalau belum ada, set sekarang lalu return id */
export function ensureUserIdCookie(): string {
  const c = cookies();
  let id = c.get(COOKIE_NAME)?.value;
  if (!id) {
    id = randomUUID();
    c.set(COOKIE_NAME, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: MAX_AGE,
    });
  }
  return id;
}
