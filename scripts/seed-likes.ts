// scripts/seed-likes.ts
// Seed contoh: naikkan counter likes per-art & isi leaderboard ZSET
// TANPA menggunakan .set (karena tidak tersedia di client KV kamu)

import kv from "@/lib/kv";

const COUNT = (id: string) => `likes:count:${id}`; // harus sama dgn yg dipakai /api/like & /api/likes
const Z_ART = "lb:art:all";
const Z_CREATOR = "lb:creator:all";

// Ganti dengan ID2 nyata dari /api/gallery (dan creator-nya kalau mau seed leaderboard uploader)
const samples: Array<{ id: string; creator?: string }> = [
  { id: "artid1", creator: "@alice" },
  { id: "artid2", creator: "@bob" },
  { id: "artid3", creator: "@carol" },
];

// Utility: set counter ke target memakai get + incr/decr loop
async function setCounterTo(id: string, target: number) {
  const raw = await kv.get(COUNT(id)); // number | null
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
    // random 1..30
    const score = Math.floor(Math.random() * 30) + 1;

    // set counter likes:count:<id> ke "score"
    await setCounterTo(s.id, score);

    // isi leaderboard per-art & per-creator
    await kv.zadd(Z_ART, { score, member: s.id });
    if (s.creator) {
      await kv.zadd(Z_CREATOR, { score, member: s.creator });
    }
  }
  console.log("seed done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
