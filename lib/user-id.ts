import { cookies } from "next/headers";

const COOKIE = "fb_uid";

/** Ambil UID dari cookie; kalau tidak ada, buat sementara (tanpa set cookie di sini). */
export function getUserIdFromCookies(): string {
  const uid = cookies().get(COOKIE)?.value;
  return uid || "anon-" + Math.random().toString(36).slice(2);
}
