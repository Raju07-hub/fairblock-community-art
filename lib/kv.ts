// lib/kv.ts
import { Redis } from "@upstash/redis";

// Support dua skema ENV: Upstash native (UPSTASH_*) dan Vercel KV (KV_REST_API_*)
const url =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "";
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "";

if (!url || !token) {
  throw new Error(
    "Missing Redis env. Set UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN (atau KV_REST_API_URL & KV_REST_API_TOKEN)."
  );
}

const kv = new Redis({ url, token });
export default kv;
