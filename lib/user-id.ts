// lib/user-id.ts
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const COOKIE_NAME = "fb_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

// Generator ID edge-safe (crypto global di Edge)
function genId(): string {
  const arr = new Uint8Array(16);
  // @ts-ignore
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
}

// Ambil uid dari cookie (Edge-ready: cookies() bisa return promise-like)
export async function getUserIdFromCookies(): Promise<string | null> {
  try {
    const cMaybe = cookies() as any;
    const c = typeof cMaybe.then === "function" ? await cMaybe : cMaybe;
    return c.get(COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

// Pastikan response memasang cookie uid bila belum ada
export async function ensureUserIdCookie(res: NextResponse): Promise<string> {
  const cMaybe = cookies() as any;
  const c = typeof cMaybe.then === "function" ? await cMaybe : cMaybe;

  let v = c.get(COOKIE_NAME)?.value;
  if (!v) v = `u_${genId()}`;

  // Next 15: sameSite lowercase
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
