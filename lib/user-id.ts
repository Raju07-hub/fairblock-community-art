// lib/user-id.ts
import { cookies } from "next/headers";

const COOKIE_NAME = "fb_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getUserIdFromCookies(): Promise<string | null> {
  try {
    const c = await cookies();
    return c.get(COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

export function generateUid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export const COOKIE_META = {
  name: COOKIE_NAME,
  maxAge: ONE_YEAR,
} as const;
