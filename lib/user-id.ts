// lib/user-id.ts
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const COOKIE_NAME = "fb_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

function genId(): string {
  // gunakan Web Crypto kalau ada (Edge-friendly), fallback ke random sederhana
  const rnd = (globalThis.crypto && "randomUUID" in globalThis.crypto)
    ? (globalThis.crypto as Crypto).randomUUID()
    : `uid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return rnd;
}

/**
 * Ambil user id dari cookie. Return null kalau tidak ada.
 * NOTE: cookies() bisa async di Edge runtime ⇒ pakai await.
 */
export async function getUserIdFromCookies(): Promise<string | null> {
  try {
    const c = await cookies();
    const v = c.get(COOKIE_NAME)?.value;
    return v ?? null;
  } catch {
    return null;
  }
}

/**
 * Pastikan cookie user id ada. Mengembalikan id yang berlaku (existing atau baru).
 * Di route handler (Node/Edge), pemanggil bisa memanggil ini lalu
 * menyetel cookie lewat response bila perlu.
 */
export async function ensureUserId(): Promise<string> {
  const existing = await getUserIdFromCookies();
  return existing ?? genId();
}

/**
 * Helper untuk MENYETEL cookie ke response (dipakai di middleware atau route).
 * Panggil ini setelah memutuskan id-nya (mis. dari ensureUserId()).
 */
export function attachUserIdCookie(res: NextResponse, id: string): void {
  res.cookies.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}
