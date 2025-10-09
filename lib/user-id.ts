// lib/user-id.ts
import { cookies } from "next/headers";

const COOKIE_NAME = "fb_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Baca UID dari cookie (jika ada). */
export async function getUserIdFromCookies(): Promise<string | null> {
  try {
    const c = await cookies();
    const v = c.get(COOKIE_NAME)?.value;
    return v ?? null;
  } catch {
    return null;
  }
}

/** Middleware akan set cookie; helper fallback untuk generate ID jika perlu. */
export function generateUid(): string {
  // Web Crypto tersedia di Edge runtime
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export const COOKIE_META = {
  name: COOKIE_NAME,
  maxAge: ONE_YEAR,
} as const;
