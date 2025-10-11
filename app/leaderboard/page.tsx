"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TopItem = {
  id: string;
  likes?: number;
  title?: string;
  owner?: string;
  postUrl?: string; // optional: open original X post
  url?: string;     // optional preview image if API provides it
};
type Creator = { user: string; uploads: number };
type Scope = "daily" | "weekly" | "alltime";

const MS = 1000, DAY = 86400000, WEEK = DAY * 7;

function nextDailyResetUTC(now = new Date()): Date {
  const targetMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return new Date(targetMs);
}
function nextWeeklyResetUTC_Saturday(now = new Date()): Date {
  const todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0);
  const day = new Date(todayMidnight).getUTCDay();
  let daysAhead = (6 - day + 7) % 7;
  let target = new Date(todayMidnight + daysAhead * DAY);
  if (now.getTime() >= target.getTime()) target = new Date(target.getTime() + WEEK);
  return target;
}
function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / MS) % 60;
  const m = Math.floor(ms / (60 * MS)) % 60;
  const h = Math.floor(ms / (3600 * MS));
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>("daily");
  const [loading, setLoading] = useState(true);
  const [topArts, setTopArts] = useState<TopItem[]>([]);
  const [topCreators, setTopCreators] = useState<Creator[]>([]);
  const [countdown, setCountdown] = useState("--:--:--");

  const btn = "btn px-4 py-1 rounded-full text-sm";
  const badge = "px-3 py-1 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#3aaefc] to-[#4af2ff]";
  const heading = "text-2xl font-bold mb-3 text-[#3aaefc]";

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/leaderboard/${scope}`, { cache: "no-store" });
      const j = await r.json();
      setTopArts(j?.top_art || []);
      setTopCreators(j?.top_creators || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [scope]);

  useEffect(() => {
    function tick() {
      const now = new Date();
      const target = scope === "weekly" ? nextWeeklyResetUTC_Saturday(now) : nextDailyResetUTC(now);
      setCountdown(formatDuration(target.getTime() - now.getTime()));
    }
    if (scope !== "alltime") {
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    } else {
      setCountdown("--:--:--");
    }
  }, [scope]);

  const resetLabel =
    scope === "weekly"
      ? "Weekly reset: every Saturday at 07:00 UTC+7"
      : scope === "daily"
      ? "Daily reset: every day at 07:00 UTC+7"
      : "All-Time";

  const headerTitle =
    scope === "alltime"
      ? "🏆 Top Art (All Time)"
      : `🏆 Top Art (${scope.toUpperCase()})`;

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      {/* toolbar */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/gallery" className="btn">🖼️ Gallery</Link>
          <Link href="/submit" className="btn">＋ Submit</Link>
          <Link href="/history" className="btn">🗂 History</Link>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <span className="text-xs opacity-70">{resetLabel}</span>
          {scope !== "alltime" && (
            <span className="text-sm font-semibold text-[#3aaefc]">Resets in {countdown}</span>
          )}
          <div className="flex gap-2">
            <button
              className={`${btn} ${scope === "daily" ? "bg-[#3aaefc]/30" : "bg-white/10"}`}
              onClick={() => setScope("daily")}
            >
              Daily
            </button>
            <button
              className={`${btn} ${scope === "weekly" ? "bg-[#3aaefc]/30" : "bg-white/10"}`}
              onClick={() => setScope("weekly")}
            >
              Weekly
            </button>
            <button
              className={`${btn} ${scope === "alltime" ? "bg-[#3aaefc]/30" : "bg-white/10"}`}
              onClick={() => setScope("alltime")}
            >
              All Time
            </button>
          </div>
          <button onClick={load} className={btn} disabled={loading}>
            ↻ {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* content */}
      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:[grid-template-columns:minmax(0,2.3fr)_minmax(0,1fr)] gap-6">
          {/* Top Art */}
          <section>
            <h2 className={heading}>{headerTitle}</h2>
            <div className="space-y-3">
              {topArts.slice(0, 10).map((t, idx) => {
                const name = t.title ?? "Untitled";
                const owner = t.owner ?? "";
                const handleNoAt = owner.replace(/^@/, "");
                const xUrl = handleNoAt ? `https://x.com/${handleNoAt}` : "";
                const permalink = `/gallery?select=${encodeURIComponent(t.id)}`;
                return (
                  <div key={t.id} className="flex items-center justify-between bg-white/5 rounded-xl p-5 md:p-6">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="w-7 text-center opacity-70">{idx + 1}.</span>

                      {t.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.url}
                          alt={name}
                          className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-2xl object-cover bg-white/10 shrink-0 shadow-md"
                          loading="lazy"
                          decoding="async"
                        />
                      )}

                      <div className="min-w-0">
                        <div className="font-medium truncate text-base">
                          {name}{" "}
                          {owner && (
                            <>
                              <span className="opacity-70">by</span>{" "}
                              <a
                                href={xUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline text-[#4af2ff]"
                              >
                                {owner}
                              </a>
                            </>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link href={permalink} className={btn}>Permalink</Link>
                          <Link href={permalink} className={btn}>See on Gallery</Link>
                          {t.postUrl && (
                            <a href={t.postUrl} target="_blank" rel="noreferrer" className={btn}>
                              Open Art Post
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={badge}>{t.likes ?? 0}</span>
                  </div>
                );
              })}
              {topArts.length === 0 && (
                <p className="opacity-70">
                  No data for this period yet. Try giving a <span className="text-pink-400">❤</span> in the Gallery, then press Refresh.
                </p>
              )}
            </div>
          </section>

          {/* Top Creators */}
          <section>
            <h2 className={heading}>🧬 Top Creators (Top 10)</h2>
            <div className="space-y-3">
              {topCreators
                .slice(0, 10)
                .sort((a, b) => b.uploads - a.uploads)
                .map((c, idx) => {
                  const handle = c.user?.startsWith("@") ? c.user : `@${c.user}`;
                  const galleryLink = `/gallery?q=${encodeURIComponent(handle)}`;
                  const xUrl = `https://x.com/${handle.replace(/^@/, "")}`;
                  return (
                    <div key={handle} className="flex items-center justify-between bg-white/5 rounded-xl p-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 text-center opacity-70 text-sm">{idx + 1}.</span>
                        <div className="min-w-0">
                          <div className="font-medium truncate text-[15px]">{handle}</div>
                          <div className="text-xs opacity-60">Uploads: {c.uploads}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Link href={galleryLink} className="btn px-3 py-1 rounded-full text-xs">
                              Search on Gallery
                            </Link>
                            <a href={xUrl} target="_blank" rel="noreferrer" className="btn px-3 py-1 rounded-full text-xs">
                              Open X Profile
                            </a>
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-[#3aaefc] to-[#4af2ff]">
                        {c.uploads}
                      </span>
                    </div>
                  );
                })}
              {topCreators.length === 0 && (
                <p className="opacity-70">No uploads counted for this period.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
