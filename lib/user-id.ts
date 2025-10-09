import { cookies as nextCookies } from "next/headers";
import { randomUUID } from "crypto";

export const COOKIE_NAME = "fb_uid";

export async function getUserIdFromCookies(): Promise<string> {
  try {
    const c = await nextCookies();
    const v = c.get(COOKIE_NAME)?.value;
    if (v) return v;

    const id = randomUUID();
    // cookie 180 hari, path=/, sameSite=Lax
    c.set(COOKIE_NAME, id, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 60 * 60 * 24 * 180,
    });
    return id;
  } catch {
    // fallback jika header cookies tidak tersedia
    return randomUUID();
  }
}
