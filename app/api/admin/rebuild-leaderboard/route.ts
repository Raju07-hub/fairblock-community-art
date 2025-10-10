// ...
const client = kv as any;

// HAPUS generic <number> di sini, gunakan konversi biasa
async function getLike(id: string): Promise<number> {
  const v = await client.get(`like:count:${id}`);
  return Number(v ?? 0);
}

// Tipekan tuple supaya rapi
const pairs: Array<[string, number]> = await Promise.all(
  ids.map(async (id) => [id, await getLike(id)] as [string, number])
);
// ...
for (const period of ["daily", "weekly"] as const) {
  const key = zkey(period).art;
  if (client.del) await client.del(key);
  for (const [id, score] of pairs) {
    if (score > 0) await client.zadd(key, { score, member: id });
  }
}
