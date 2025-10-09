import { cookies } from "next/headers";

const COOKIE_NAME = "fb_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

function genId(): string {
  const arr = new Uint8Array(16);
  // @ts-ignore Edge crypto
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
}

export async function getUserIdFromCookies(): Promise<string | null> {
  try {
    const cMaybe = cookies() as any;
    const c = typeof cMaybe.then === "function" ? await cMaybe : cMaybe;
    const v = c.get(COOKIE_NAME)?.value;
    return v ?? null;
  } catch {
    return null;
  }
}

export async function ensureUserIdCookie(res: import("next/server").NextResponse) {
  const cMaybe = cookies() as any;
  const c = typeof cMaybe.then === "function" ? await cMaybe : cMaybe;
  let v = c.get(COOKIE_NAME)?.value;
  if (!v) v = `u_${genId()}`;
  // ✅ perbaiki sameSite → "lax" (lowercase)
  res.cookies.set({
    name: COOKIE_NAME,
    value: v,
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: ONE_YEAR,
  });
  return v;
}
