// scripts/seed-likes.ts
// Seed contoh: naikkan counter likes per-art & isi leaderboard ZSET tanpa zadd()

import kv from "@/lib/kv";

const COUNT = (id: string) => `likes:count:${id}`;
const Z_ART = "lb:art:all";
const Z_CREATOR = "lb:creator:all";

const samples: Array<{ id: string; creator?: string }> = [
  { id: "artid1", creator: "@alice" },
  { id: "artid2", creator: "@bob" },
  { id: "artid3", creator: "@carol" },
];

async function setCounterTo(id: string, target: number) {
  const raw = await kv.get(COUNT(id));
  const current = typeof raw === "number" ? raw : 0;
  let delta = target - current;

  if (delta > 0) {
    while (delta-- > 0) await kv.incr(COUNT(id));
  } else if (delta < 0) {
    while (delta++ < 0) await kv.decr(COUNT(id));
  }
}

async function main() {
  for (const s of samples) {
    const score = Math.floor(Math.random() * 30) + 1;

    // set counter likes:count:<id> ke "score"
    await setCounterTo(s.id, score);

    // leaderboard pakai zincrby
    await kv.zincrby(Z_ART, score, s.id);
    if (s.creator) {
      await kv.zincrby(Z_CREATOR, score, s.creator);
    }
  }

  console.log("✅ seed done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
