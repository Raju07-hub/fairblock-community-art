// lib/user-id.ts
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE_NAME = "fb_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function getUserIdFromCookies(): string | null {
  try {
    // cookies() di Next 15 bersifat sync: langsung pakai
    const c = cookies();
    const v = c.get(COOKIE_NAME)?.value;
    return v || null;
  } catch {
    return null;
  }
}

/** Pastikan cookie identitas user ada (dipakai di middleware.ts) */
export function ensureUserCookie() {
  try {
    const store = cookies();
    if (!store.get(COOKIE_NAME)?.value) {
      store.set(COOKIE_NAME, randomUUID(), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: ONE_YEAR,
      });
    }
  } catch {
    // noop
  }
}
