// lib/kv.ts — selalu gunakan Vercel KV REST (aman untuk Edge)
const REST_URL = process.env.KV_REST_API_URL!;
const REST_TOKEN = process.env.KV_REST_API_TOKEN!;
if (!REST_URL || !REST_TOKEN) {
  throw new Error("Missing KV_REST_API_URL / KV_REST_API_TOKEN");
}

async function pipe(cmds: (string | number)[][]) {
  const r = await fetch(`${REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmds),
    // jangan cache di edge
    cache: "no-store",
  });
  if (!r.ok) throw new Error("KV REST error");
  return r.json() as Promise<{ result: any }[]>;
}

const kv = {
  async incr(key: string): Promise<number> {
    const [x] = await pipe([["INCR", key]]);
    return Number(x.result ?? 0);
  },
  async decr(key: string): Promise<number> {
    const [x] = await pipe([["DECR", key]]);
    return Number(x.result ?? 0);
  },
  async get(key: string): Promise<number | null> {
    const [x] = await pipe([["GET", key]]);
    return x.result === null ? null : Number(x.result);
  },
  async mget(...keys: string[]): Promise<(number | null)[]> {
    const rows = await pipe(keys.map((k) => ["GET", k]));
    return rows.map((r) => (r.result === null ? null : Number(r.result)));
  },
  async sadd(key: string, member: string): Promise<number> {
    const [x] = await pipe([["SADD", key, member]]);
    return Number(x.result ?? 0);
  },
  async srem(key: string, member: string): Promise<number> {
    const [x] = await pipe([["SREM", key, member]]);
    return Number(x.result ?? 0);
  },
  async sismember(key: string, member: string): Promise<number> {
    const [x] = await pipe([["SISMEMBER", key, member]]);
    return Number(x.result ?? 0);
  },
  async zincrby(key: string, n: number, member: string): Promise<number> {
    const [x] = await pipe([["ZINCRBY", key, n, member]]);
    return Number(x.result ?? 0);
  },
  async zrevrange(
    key: string,
    start: number,
    stop: number,
    opts?: { withScores?: boolean }
  ): Promise<(string | number)[]> {
    const cmd: (string | number)[] = ["ZREVRANGE", key, start, stop];
    if (opts?.withScores) cmd.push("WITHSCORES");
    const [x] = await pipe([cmd]);
    return x.result as (string | number)[];
  },
};

export default kv;
