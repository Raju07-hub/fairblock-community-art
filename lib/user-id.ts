// lib/user-id.ts
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

/**
 * Memberi ID unik per browser via cookie httpOnly.
 * Aman dipakai di Route Handlers (server).
 */
export function getUserId(): string {
  const name = "fb_uid";

  // Baca cookie existing
  const store = cookies();
  let uid = store.get(name)?.value;

  // Jika belum ada, buat baru dan set cookie 5 tahun
  if (!uid) {
    uid = randomUUID();
    store.set({
      name,
      value: uid,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 5, // 5 tahun
    });
  }
  return uid;
}
