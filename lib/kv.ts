// lib/kv.ts
// Kalau pakai @vercel/kv langsung, ini cukup:
import { kv } from "@vercel/kv";
export default kv;

// Kalau wrapper custom, wajib punya: incr, decr, get, mget, zincrby, zrevrange
