// lib/kv.ts
import { Redis } from "@upstash/redis";

// Wajib set env ini di Vercel: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
// Redis.fromEnv() otomatis baca dua env itu, dan aman untuk Edge/Node.
const kv = Redis.fromEnv();
export default kv;
