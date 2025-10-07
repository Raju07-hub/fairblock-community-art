"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ArtRow = { id: string; title: string; url: string; likes: number; author?: string };
type CreatorRow = { handle: string; likes: number };

export default function LeaderboardPage() {
  const [range, setRange] = useState<"daily" | "weekly" | "monthly">("daily");
  const [arts, setArts] = useState<ArtRow[]>([]);
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/leaderboard?range=${range}`, { cache: "no-store" });
        const j = await r.json();
        if (mounted && j?.success) {
          setArts(j.arts || []);
          setCreators(j.creators || []);
        }
      } catch {}
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [range]);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/gallery" className="btn">🖼️ Gallery</Link>
          <Link href="/submit" className="btn">＋ Submit</Link>
        </div>

        <select
          value={range}
          onChange={(e) => setRange(e.target.value as any)}
          className="btn"
          title="Select period"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {/* TOP ART */}
      <h1 className="text-3xl font-bold text-gradient mb-3">🏆 Top Art</h1>
      {loading ? (
        <p className="text-white/70">Loading…</p>
      ) : arts.length === 0 ? (
        <p className="text-white/70">No results yet.</p>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(260px,1fr))] mb-10">
          {arts.map((a, idx) => (
            <div key={a.id} className="glass rounded-2xl p-4">
              <div className="relative w-full h-44 rounded-xl bg-white/5 overflow-hidden mb-3 flex items-center justify-center">
                {a.url ? (
                  <img src={a.url} alt={a.title} className="w-full h-full object-contain" />
                ) : (
                  <div className="text-white/40 text-sm">No Image</div>
                )}
                <div className="absolute top-2 left-2 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-sm">
                  #{idx + 1}
                </div>
                <div className="absolute top-2 right-2 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-sm">
                  ❤️ {a.likes}
                </div>
              </div>
              <div className="font-semibold">{a.title}</div>
              {a.author && (
                <div className="text-sm text-white/70 mt-1">@{a.author}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TOP CREATORS */}
      <h2 className="text-2xl font-bold text-gradient mb-3">🌟 Top Creators</h2>
      {loading ? (
        <p className="text-white/70">Loading…</p>
      ) : creators.length === 0 ? (
        <p className="text-white/70">No creators yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-white/60">
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Creator</th>
                <th className="px-3 py-2">Likes</th>
                <th className="px-3 py-2">Links</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c, i) => {
                const handle = c.handle || "";
                const xLink = handle ? `https://x.com/${handle.replace(/^@/, "")}` : null;
                const isDiscordId = /^\d{17,20}$/.test(handle);
                const discordLink = isDiscordId ? `https://discord.com/users/${handle}` : null;
                return (
                  <tr key={`${handle}-${i}`} className="glass rounded-xl">
                    <td className="px-3 py-2">#{i + 1}</td>
                    <td className="px-3 py-2 font-semibold">@{handle}</td>
                    <td className="px-3 py-2">❤️ {c.likes}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        {xLink && <a href={xLink} target="_blank" className="btn-ghost text-sm underline">Open X ↗</a>}
                        {discordLink && <a href={discordLink} target="_blank" className="btn-ghost text-sm underline">Open Discord ↗</a>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
