"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ==========================
// Types
// ==========================
type TopItem = { id: string; score?: number; likes?: number; title?: string; owner?: string };
type GalleryItem = { id: string; title: string; url: string; x?: string; discord?: string; createdAt: string };
type CreatorRow = { user: string; uploads: number };

type Scope = "daily" | "weekly" | "alltime";
type Mode = "current" | "previous";

// ==========================
// Helper Components
// ==========================
function Segmented<T extends string>({
  value, options, onChange, className = ""
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex rounded-full bg-white/10 p-1 ${className}`}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-full text-sm transition
            ${value === opt.value ? "bg-white/20 text-white" : "text-white/75 hover:text-white"}`}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ==========================
// Utility Functions
// ==========================
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
function handleFromItem(it: GalleryItem): string {
  const x = (it.x || "").replace(/^@/, "");
  if (x) return `@${x}`;
  const d = (it.discord || "").replace(/^@/, "");
  return d ? `@${d}` : "";
}

// ==========================
// Page Component
// ==========================
export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>("daily");
  const [mode, setMode] = useState<Mode>("current");
  const [loading, setLoading] = useState(true);
  const [topArts, setTopArts] = useState<TopItem[]>([]);
  const [topCreators, setTopCreators] = useState<CreatorRow[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [countdown, setCountdown] = useState("--:--:--");
  const [keyDate, setKeyDate] = useState<string | null>(null);

  const btn = "btn px-4 py-1 rounded-full text-sm";
  const btnSm = "btn px-3 py-1 rounded-full text-xs";
  const badge = "px-3 py-1 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#3aaefc] to-[#4af2ff]";
  const badgeSm = "px-2.5 py-0.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-[#3aaefc] to-[#4af2ff]";
  const heading = "text-2xl font-bold mb-3 text-[#3aaefc]";

  // ==========================
  // Data Fetcher
  // ==========================
  async function load() {
    setLoading(true);
    try {
      const g = await fetch(`/api/gallery`, { cache: "no-store" })
        .then(res => res.json()).catch(() => ({}));
      setGallery(g?.items ?? []);

      if (scope === "alltime") {
        const r = await fetch(`/api/leaderboard/alltime`, { cache: "no-store" });
        const j = await r.json();
        setTopArts((j?.top_art || []).map((x: any) => ({ id: x.id, likes: x.likes, title: x.title, owner: x.owner })));
        setTopCreators((j?.top_creators || []).map((c: any) => ({ user: c.user, uploads: c.uploads })));
        setKeyDate(null);
      } else {
        const r = await fetch(`/api/history/${scope}/${mode}`, { cache: "no-store" });
        const j = await r.json();
        setTopArts(j?.top_art || []);
        setTopCreators((j?.top_creators || []).map((c: any) => ({ user: c.user, uploads: c.uploads })));
        setKeyDate(j?.keyDate || null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope, mode]);

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

  const byId = useMemo(() => new Map(gallery.map(it => [it.id, it])), [gallery]);

  const resetLabel =
    scope === "weekly"
      ? "Weekly reset: every Saturday at 00:00 UTC+7"
      : scope === "daily"
      ? "Daily reset: every day at 00:00 UTC+7"
      : "All-Time";

  const headerTitle =
    scope === "alltime"
      ? "🏆 Top Art (All Time)"
      : `🏆 Top Art (${scope} — ${mode})${keyDate ? ` · ${keyDate}` : ""}`;

  // ==========================
  // Render
  // ==========================
  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/gallery" className="btn">🖼️ Gallery</Link>
          <Link href="/submit" className="btn">＋ Submit</Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-xs opacity-70">{resetLabel}</span>
            {scope !== "alltime" && <span className="text-sm font-semibold text-[#3aaefc]">Resets in {countdown}</span>}
          </div>

          <Segmented
            value={scope}
            onChange={(v) => setScope(v as Scope)}
            options={[
              { label: "Daily", value: "daily" as Scope },
              { label: "Weekly", value: "weekly" as Scope },
              { label: "All Time", value: "alltime" as Scope },
            ]}
          />

          {scope !== "alltime" && (
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              options={[
                { label: "Current", value: "current" as Mode },
                { label: "Previous", value: "previous" as Mode },
              ]}
            />
          )}

          <button onClick={load} className="btn" disabled={loading}>
            ↻ {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-white/70">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:[grid-template-columns:minmax(0,2.2fr)_minmax(0,0.9fr)] gap-6">
          {/* --- Top Art --- */}
          <section>
            <h2 className={heading}>{headerTitle}</h2>
            {topArts.length === 0 ? (
              <div className="opacity-70 text-sm mt-3">
                Belum ada data untuk periode ini. Coba kasih ❤️ di Gallery, lalu klik Refresh.
              </div>
            ) : (
              <div className="space-y-3">
                {topArts
                  .filter(t => scope === "alltime" ? true : byId.has(t.id))
                  .slice(0, 10)
                  .map((t, idx) => {
                    const g = byId.get(t.id) as GalleryItem | undefined;
                    const name = t.title ?? g?.title ?? "Untitled";
                    const owner = (t.owner ?? (g ? handleFromItem(g) : "") ?? "").toString();
                    const handleNoAt = owner.replace(/^@/, "");
                    const xUrl = handleNoAt ? `https://x.com/${handleNoAt}` : "";
                    const seeOnGallery = `/gallery?select=${encodeURIComponent(t.id)}`;
                    const score = typeof t.likes === "number" ? t.likes : (t.score ?? 0);

                    return (
                      <div key={t.id} className="flex items-center justify-between bg-white/5 rounded-xl p-5 md:p-6">
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="w-7 text-center opacity-70">{idx + 1}.</span>
                          <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-2xl overflow-hidden bg-white/10 shrink-0 shadow-md">
                            {g?.url ? (
                              <img
                                src={g.url}
                                alt={name}
                                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                loading="lazy"
                                decoding="async"
                                fetchPriority="high"
                                onError={(e) => (e.currentTarget.style.display = "none")}
                              />
                            ) : (
                              <span className="text-xs opacity-50">No Image</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate text-base">
                              {name}{" "}
                              {owner && (
                                <>
                                  <span className="opacity-70">by</span>{" "}
                                  <a href={xUrl} target="_blank" rel="noopener noreferrer" className="underline text-[#4af2ff]">
                                    {owner}
                                  </a>
                                </>
                              )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Link href={seeOnGallery} className={btn}>See on Gallery</Link>
                            </div>
                          </div>
                        </div>
                        <span className={badge}>{score}</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>

          {/* --- Top Creators (uploads-based) --- */}
          <section>
            <h2 className={heading}>🧬 Top Creators (Top 10)</h2>
            {topCreators.length === 0 ? (
              <div className="opacity-70 text-sm mt-3">
                Belum ada upload terhitung di periode ini.
              </div>
            ) : (
              <div className="space-y-3">
                {topCreators
                  .slice(0, 50)
                  .sort((a, b) => (b.uploads - a.uploads))
                  .slice(0, 10)
                  .map((c, idx) => {
                    const handle = c.user?.startsWith("@") ? c.user : `@${c.user}`;
                    const galleryLink = `/gallery?q=${encodeURIComponent(handle)}`;
                    const xUrl = `https://x.com/${String(handle || "").replace(/^@/, "")}`;
                    return (
                      <div key={handle} className="flex items-center justify-between bg-white/5 rounded-xl p-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 text-center opacity-70 text-sm">{idx + 1}.</span>
                          <div className="min-w-0">
                            <div className="font-medium truncate text-[15px]">{handle}</div>
                            <div className="text-xs opacity-60">
                              Uploads{scope !== "alltime" ? " (period)" : ""}: {c.uploads}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Link href={galleryLink} className={btnSm}>Search on Gallery</Link>
                              <a href={xUrl} target="_blank" rel="noopener noreferrer" className={btnSm}>Open X Profile</a>
                            </div>
                          </div>
                        </div>
                        <span className={badgeSm}>{c.uploads}</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
