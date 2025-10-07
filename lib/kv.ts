// lib/kv.ts
import { Redis } from "@upstash/redis";

const kv = Redis.fromEnv(); // otomatis baca env UPSTASH_REDIS_REST_URL/TOKEN
export default kv;
