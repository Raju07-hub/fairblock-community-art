// lib/user-id.ts
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE_NAME = "fb_uid";

/** Ambil userId dari cookies (return null jika belum ada) */
export async function getUserIdFromCookies(): Promise<string | null> {
  try {
    const c = await cookies(); // <- cookies() adalah Promise
    const v = c.get(COOKIE_NAME)?.value;
    return v || null;
  } catch {
    return null;
  }
}

/** Pastikan userId tersedia di cookies; jika belum ada, buat baru dan set. */
export async function ensureUserIdCookie(): Promise<string> {
  try {
    const c = await cookies();
    const existing = c.get(COOKIE_NAME)?.value;
    if (existing) return existing;

    const newId = randomUUID();
    // umur 1 tahun
    c.set({
      name: COOKIE_NAME,
      value: newId,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false, // biar client bisa baca kalau perlu
      sameSite: "lax",
    });
    return newId;
  } catch {
    // fallback kalau environment melarang set cookie
    return randomUUID();
  }
}
