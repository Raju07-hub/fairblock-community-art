"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Scope = "daily" | "weekly";
type PeriodItem = { key: string; label: string; display: string };

export default function HistoryPage() {
  const [scope, setScope] = useState<Scope>("daily");
  const [list, setList] = useState<PeriodItem[]>([]);
  const [loading, setLoading] = useState(true);

  const btn = "btn px-4 py-1 rounded-full text-sm transition";
  const card =
    "block text-left bg-white/5 hover:bg-white/10 transition rounded-xl p-4 shadow";
  const header = "text-2xl font-bold mb-4 text-[#3aaefc]";

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/history/list?scope=${scope}&limit=${scope === "daily" ? 30 : 26}`,
        { cache: "no-store" }
      );
      const j = await r.json();
      setList(j?.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [scope]);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="btn">
            ⬅ Back Home
          </Link>
          <Link href="/gallery" className="btn">
            🖼️ Gallery
          </Link>
          <Link href="/submit" className="btn">
            ➕ Submit
          </Link>
          <Link href="/leaderboard" className="btn">
            🏆 Leaderboard
          </Link>
        </div>

        {/* Scope Toggle */}
        <div className="flex gap-2 flex-wrap">
          <button
            className={`${btn} ${
              scope === "daily"
                ? "bg-[#3aaefc]/30 text-white"
                : "bg-white/10 text-gray-300"
            }`}
            onClick={() => setScope("daily")}
          >
            Daily
          </button>
          <button
            className={`${btn} ${
              scope === "weekly"
                ? "bg-[#3aaefc]/30 text-white"
                : "bg-white/10 text-gray-300"
            }`}
            onClick={() => setScope("weekly")}
          >
            Weekly
          </button>
          <button onClick={load} className={`${btn} bg-white/10`}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Page Header */}
      <h1 className={header}>
        📚 Leaderboard History ({scope === "daily" ? "Daily" : "Weekly"})
      </h1>

      {/* Data Section */}
      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : list.length === 0 ? (
        <p className="opacity-70">No history found yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((it) => (
            <Link
              key={it.key}
              href={`/history/${scope}/${encodeURIComponent(it.key)}`}
              className={card}
            >
              <div className="text-sm opacity-60">
                {scope === "weekly" ? "Weekly" : "Daily"}
              </div>
              <div className="font-semibold mt-1">{it.display}</div>
              <div className="mt-3 text-xs opacity-60">
                Click to view Top 10 artworks
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
