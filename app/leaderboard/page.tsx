// app/leaderboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TopArt = { id: string; score: number };
type TopCreator = { name: string; score: number };
type Period = "daily" | "weekly";

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [arts, setArts] = useState<TopArt[]>([]);
  const [creators, setCreators] = useState<TopCreator[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?period=${period}`, { cache: "no-store" });
      const j = await res.json();
      if (j?.success) {
        setArts(j.arts || []);
        setCreators(j.creators || []);
      } else {
        setArts([]);
        setCreators([]);
      }
    } catch {
      setArts([]);
      setCreators([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/gallery" className="btn">🖼️ Gallery</Link>
          <Link href="/submit" className="btn">＋ Submit</Link>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="btn"
            title="Choose period"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <button className="btn-ghost" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Top Art */}
        <div>
          <h2 className="text-2xl font-bold mb-3">🏆 Top Art (Top 10)</h2>
          {arts.length === 0 ? (
            <p className="text-white/70">No results yet.</p>
          ) : (
            <ol className="space-y-2">
              {arts.map((a, i) => (
                <li key={a.id} className="glass rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-white/70 w-6 text-right">{i + 1}.</span>
                    <span className="font-semibold truncate max-w-[220px]">{a.id}</span>
                  </div>
                  <span className="badge-like-big liked">{a.score}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Top Creators */}
        <div>
          <h2 className="text-2xl font-bold mb-3">🧩 Top Creators (Top 10)</h2>
          {creators.length === 0 ? (
            <p className="text-white/70">No creators yet.</p>
          ) : (
            <ol className="space-y-2">
              {creators.map((c, i) => (
                <li key={`${c.name}-${i}`} className="glass rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-white/70 w-6 text-right">{i + 1}.</span>
                    <span className="font-semibold truncate max-w-[220px]">
                      {c.name.startsWith("@") ? c.name : `@${c.name}`}
                    </span>
                  </div>
                  <span className="badge-like-big liked">{c.score}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
