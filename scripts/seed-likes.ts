import kv from "@/lib/kv";

async function main() {
  const ids = ["artid1","artid2","artid3"]; // ganti ID nyata dari /api/gallery
  for (const id of ids) {
    await kv.set(`likes:count:${id}`, Math.floor(Math.random()*30)+1);
    await kv.zadd(`lb:daily:2025-10-08`, { score: Math.floor(Math.random()*30)+1, member:id });
  }
  console.log("seed done");
}
main();
