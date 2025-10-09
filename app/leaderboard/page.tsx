// app/leaderboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TopItem = { id: string; score: number };
type GalleryItem = { id: string; title: string; url: string; x?: string; discord?: string; createdAt: string };
type LbResp = { success: boolean; topArts: TopItem[] };

function handleFromItem(it: GalleryItem): string {
  const x = (it.x || "").replace(/^@/, "");
  if (x) return `@${x}`;
  const d = (it.discord || "").replace(/^@/, "");
  return d ? `@${d}` : "";
}

// ---------- Countdown helpers (UTC based) ----------
const MS = 1000, DAY = 86400000, WEEK = DAY * 7;

function nextDailyResetUTC(now = new Date()): Date {
  // Next 00:00 UTC
  const targetMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return new Date(targetMs);
}

function nextWeeklyResetUTC_Saturday(now = new Date()): Date {
  // Weekly reset every Saturday 00:00 UTC
  const todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0);
  const day = new Date(todayMidnight).getUTCDay(); // 0=Sun..6=Sat
  let daysAhead = (6 - day + 7) % 7; // distance to Saturday
  let target = new Date(todayMidnight + daysAhead * DAY);
  if (now.getTime() >= target.getTime()) target = new Date(target.getTime() + WEEK);
  return target;
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const sec = Math.floor(ms / MS) % 60;
  const min = Math.floor(ms / (60 * MS)) % 60;
  const hrs = Math.floor(ms / (3600 * MS));
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(hrs)}:${pad(min)}:${pad(sec)}`;
}
// ---------------------------------------------------

export default function LeaderboardPage() {
  const [range, setRange] = useState<"daily" | "weekly">("daily");
  const [loading, setLoading] = useState(true);
  const [lb, setLb] = useState<LbResp | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [countdown, setCountdown] = useState<string>("--:--:--");

  const btn = "btn px-4 py-1 rounded-full text-sm";
  const badge = "px-3 py-1 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#3aaefc] to-[#4af2ff]";
  const heading = "text-2xl font-bold mb-3 text-[#3aaefc]";

  async function load(currentRange: "daily" | "weekly") {
    setLoading(true);
    try {
      const r = await fetch(`/api/leaderboard?range=${currentRange}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      const normalized: LbResp = { success: !!j?.success, topArts: j?.topArts ?? j?.arts ?? [] };
      const g = await fetch(`/api/gallery`, { cache: "no-store" }).then(res => res.json()).catch(() => ({}));
      setLb(normalized);
      setGallery(g?.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(range); }, [range]);

  // Tick countdown setiap detik
  useEffect(() => {
    function compute() {
      const now = new Date();
      const target =
        range === "weekly" ? nextWeeklyResetUTC_Saturday(now) : nextDailyResetUTC(now);
      setCountdown(formatDuration(target.getTime() - now.getTime()));
    }
    compute();
    const t = setInterval(compute, 1000);
    return () => clearInterval(t);
  }, [range]);

  const byId = useMemo(() => new Map(gallery.map(it => [it.id, it])), [gallery]);

  const uploadsByCreator = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of gallery) {
      const h = handleFromItem(it);
      if (!h) continue;
      m.set(h, (m.get(h) || 0) + 1);
    }
    return m;
  }, [gallery]);

  const topCreators = useMemo(() => {
    const arr = Array.from(uploadsByCreator.entries()).map(([creator, score]) => ({ creator, score }));
    arr.sort((a, b) => b.score - a.score);
    return arr.slice(0, 10);
  }, [uploadsByCreator]);

  // Label info sesuai range
  const resetLabel =
  range === "weekly"
    ? "Weekly reset: every Saturday at 00:00 UTC+7"
    : "Daily reset: every day at 00:00 UTC+7";
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/gallery" className="btn">🖼️ Gallery</Link>
          <Link href="/submit" className="btn">＋ Submit</Link>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-xs opacity-70">{resetLabel}</span>
            <span className="text-sm font-semibold text-[#3aaefc]">Resets in {countdown}</span>
          </div>
          <select value={range} onChange={e => setRange(e.target.value as "daily" | "weekly")} className="btn">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <button onClick={() => load(range)} className="btn" disabled={loading}>
            ↻ {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-white/70">Loading…</p>
      ) : !lb?.success ? (
        <p className="text-white/70">Failed to load.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* --- Top Art --- */}
          <section>
            <h2 className={heading}>🏆 Top Art (Top 10)</h2>
            <div className="space-y-3">
              {lb.topArts.slice(0, 10).map((t, idx) => {
                const g = byId.get(t.id);
                const handle = g ? handleFromItem(g) : "";
                const handleNoAt = handle.replace(/^@/, "");
                const xUrl = handleNoAt ? `https://x.com/${handleNoAt}` : "";
                const seeOnGallery = `/gallery?select=${encodeURIComponent(t.id)}`;

                return (
                  <div key={t.id} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 text-center opacity-70">{idx + 1}.</span>
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/10 shrink-0">
                        {g && <img src={g.url} alt={g.title} className="w-full h-full object-cover" loading="lazy" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {g?.title || "Untitled"}{" "}
                          {handle && (
                            <>
                              <span className="opacity-70">by</span>{" "}
                              <a href={xUrl} target="_blank" rel="noopener noreferrer" className="underline text-[#4af2ff]">
                                {handle}
                              </a>
                            </>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link href={seeOnGallery} className={btn}>See on Gallery</Link>
                          {handle && <a href={xUrl} target="_blank" rel="noopener noreferrer" className={btn}>Open X Profile</a>}
                        </div>
                      </div>
                    </div>
                    <span className={badge}>{t.score}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* --- Top Creators --- */}
          <section>
            <h2 className={heading}>🧬 Top Creators (Top 10)</h2>
            <div className="space-y-3">
              {topCreators.map((c, idx) => {
                const handle = c.creator.startsWith("@") ? c.creator : `@${c.creator}`;
                const galleryLink = `/gallery?q=${encodeURIComponent(handle)}`;
                const xUrl = `https://x.com/${handle.replace(/^@/, "")}`;

                return (
                  <div key={handle} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 text-center opacity-70">{idx + 1}.</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{handle}</div>
                        <div className="text-xs opacity-60">Uploads: {c.score}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link href={galleryLink} className={btn}>Search on Gallery</Link>
                          <a href={xUrl} target="_blank" rel="noopener noreferrer" className={btn}>Open X Profile</a>
                        </div>
                      </div>
                    </div>
                    <span className={badge}>{c.score}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
