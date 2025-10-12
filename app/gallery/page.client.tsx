// app/gallery/page.client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Item = {
  id: string;
  title?: string;
  url?: string;
  x?: string;
  discord?: string;
  postUrl?: string;
};

export default function GalleryClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (onlyMine) params.set("mine", "1");
      params.set("sort", sort);

      const r = await fetch(`/api/gallery?${params.toString()}`, { cache: "no-store" });
      const j = await r.json();
      setItems(Array.isArray(j?.items) ? j.items : []);
    } finally {
      setLoading(false);
    }
  }

  // initial + sort change
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const s = q.trim().toLowerCase();
    return items.filter((it) =>
      (it.title || "").toLowerCase().includes(s) ||
      (it.x || "").toLowerCase().includes(s) ||
      (it.discord || "").toLowerCase().includes(s)
    );
  }, [items, q]);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/submit" className="btn">＋ Submit Art</Link>
          <Link href="/leaderboard" className="btn">🏆 Leaderboard</Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title / @x / discord…"
            className="input px-4 py-2 rounded-full bg-white/10"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="input px-3 py-2 rounded-full bg-white/10"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Only My Uploads
          </label>
          <button className="btn px-4 py-2 rounded-full" onClick={load} disabled={loading}>
            ↻ {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="opacity-70">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="opacity-70">No artworks found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((it) => (
            <div key={it.id} id={`art-${it.id}`} className="card p-3 rounded-2xl bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {it.url && <img src={it.url} alt={it.title || "Artwork"} className="w-full h-56 object-cover rounded-xl" />}
              <div className="mt-3">
                <div className="font-semibold truncate">{it.title || "Untitled"}</div>
                <div className="text-sm opacity-70">
                  {it.x && <a href={`https://x.com/${it.x.replace(/^@/, "")}`} target="_blank" rel="noreferrer">{it.x}</a>}
                  {it.discord && <> · {it.discord}</>}
                </div>
                <div className="mt-2 flex gap-2">
                  <Link href={`/art/${it.id}`} className="btn px-3 py-1 rounded-full text-sm">Open</Link>
                  {it.postUrl && <a href={it.postUrl} target="_blank" rel="noreferrer" className="btn px-3 py-1 rounded-full text-sm">X Post</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
