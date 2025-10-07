// lib/user-id.ts
import type { NextRequest } from "next/server";
import { createHash } from "crypto";

/**
 * Hasilkan ID pseudo-anon untuk user berbasis header (IP + User-Agent).
 * Parameter `req` opsional, jadi aman dipanggil `getUserId()` atau `getUserId(req)`.
 */
export function getUserId(req?: NextRequest): string {
  const ua = req?.headers.get("user-agent") ?? "";
  // X-Forwarded-For bisa berisi banyak IP, ambil yang pertama
  const ipRaw = req?.headers.get("x-forwarded-for") ?? "";
  const ip = ipRaw.split(",")[0].trim();

  const seed = `${ip}|${ua}|fairblock-salt`;
  const hash = createHash("sha256").update(seed).digest("hex");
  // cukup 32 char agar pendek tapi stabil
  return hash.slice(0, 32);
}

export default getUserId;
