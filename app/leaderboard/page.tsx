"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/** ===== Types ===== */
type TopItem = { id: string; score?: number; likes?: number; title?: string; owner?: string };
type GalleryItem = { id: string; title: string; url: string; x?: string; discord?: string; createdAt: string };
type CreatorRow = { user: string; uploads: number };

type Scope = "daily" | "weekly" | "alltime";

/** ===== Tiny Dark Dropdown ===== */
function DarkDropdown({
  label,
  items,
  onSelect,
  className = "",
}: {
  label: string;
  items: { value: string; label: string }[];
  onSelect: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-4 py-1 rounded-full text-sm bg-gradient-to-r from-indigo-400/30 to-cyan-400/30 text-white shadow hover:brightness-110"
      >
        {label} <span className="opacity-80">▾</span>
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 min-w-[180px] rounded-lg border border-white/10 bg-black/85 backdrop-blur p-1 shadow-2xl"
          onMouseLeave={() => setOpen(false)}
        >
          {items.map((it) => (
            <button
              key={it.value}
              onClick={() => {
                onSelect(it.value);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-white/90 hover:bg-white/10"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ===== Utils ===== */
const MS = 1000, DAY = 86400000, WEEK = DAY * 7;

function nextDailyResetUTC(now = new Date()): Date {
  // reset harian jam 07:00 UTC+7 == 00:00 UTC
  const targetMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return new Date(targetMs);
}
function nextWeeklyResetUTC_Saturday_7am_UTCplus7(now = new Date()): Date {
  // 07:00 UTC+7 == 00:00 UTC; sama seperti di atas, tapi untuk Sabtu
  const todayMidnightUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0);
  const day = new Date(todayMidnightUTC).getUTCDay(); // 0..6 (Sun..Sat)
  // cari sabtu berikutnya (UTC-midnight == 07:00 UTC+7)
  let daysAhead = (6 - day + 7) % 7;
  let targetUTC = todayMidnightUTC + daysAhead * DAY;
  if (now.getTime() >= targetUTC) targetUTC += WEEK;
  return new Date(targetUTC);
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

/** ===== Helpers for History Labels (UTC+7 presentation) ===== */
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function toDateFromYMD(key: string): Date {
  // key: YYYY-MM-DD -> interpret as UTC midnight for that day
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
}
function labelDaily(key: string): string {
  const dt = toDateFromYMD(key);
  // shift to UTC+7 only for label
  const plus7 = new Date(dt.getTime() + 7 * 3600 * 1000);
  const wd = WEEKDAYS[plus7.getUTCDay()];
  return `${wd} — ${key} · 07:00 UTC+7`;
}
function mondayOfISOWeek(year: number, week: number): Date {
  // Return Monday 00:00 UTC of ISO week
  const simple = new Date(Date.UTC(year, 0, 4));
  const dow = simple.getUTCDay() || 7;
  simple.setUTCDate(simple.getUTCDate() + (week - 1) * 7 + (1 - dow));
  return simple;
}
function labelWeekly(key: string): { label: string; range: { start: string; end: string } } {
  // key: YYYY-W##
  const [yStr, wStr] = key.split("-W");
  const year = Number(yStr), week = Number(wStr);
  const monUTC = mondayOfISOWeek(year, week); // Monday 00:00 UTC
  const sunUTC = new Date(monUTC.getTime() + 6 * DAY);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const start = fmt(monUTC);
  const end = fmt(sunUTC);
  const label = `Week ${key} — ${start} → ${end} · snapshot Sat 07:00 UTC+7`;
  return { label, range: { start, end } };
}

/** ===== Page ===== */
export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>("daily");
  const [loading, setLoading] = useState(true);
  const [topArts, setTopArts] = useState<TopItem[]>([]);
  const [topCreators, setTopCreators] = useState<CreatorRow[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [countdown, setCountdown] = useState("--:--:--");
  const [activeKey, setActiveKey] = useState<string | null>(null); // key when viewing history ("custom" implicitly)

  const btn = "btn px-4 py-1 rounded-full text-sm";
  const btnSm = "btn px-3 py-1 rounded-full text-xs";
  const badge = "px-3 py-1 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#3aaefc] to-[#4af2ff]";
  const badgeSm = "px-2.5 py-0.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-[#3aaefc] to-[#4af2ff]";
  const heading = "text-2xl font-bold mb-3 text-[#3aaefc]";

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
        setActiveKey(null);
      } else if (activeKey) {
        // view a specific historical key
        const r = await fetch(`/api/history/by?scope=${scope}&key=${encodeURIComponent(activeKey)}`, { cache: "no-store" });
        const j = await r.json();
        setTopArts(j?.top_art || []);
        setTopCreators((j?.top_creators || []).map((c: any) => ({ user: c.user, uploads: c.uploads })));
      } else {
        // current period
        const r = await fetch(`/api/history/${scope}/current`, { cache: "no-store" });
        const j = await r.json();
        setTopArts(j?.top_art || []);
        setTopCreators((j?.top_creators || []).map((c: any) => ({ user: c.user, uploads: c.uploads })));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope, activeKey]);

  useEffect(() => {
    function tick() {
      const now = new Date();
      const target = scope === "weekly" ? nextWeeklyResetUTC_Saturday_7am_UTCplus7(now) : nextDailyResetUTC(now);
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

  // Fallback all-time uploads (dipakai kalau API periode kosong)
  const uploadsAllTime = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of gallery) {
      const h = handleFromItem(it);
      if (!h) continue;
      m.set(h, (m.get(h) || 0) + 1);
    }
    return Array.from(m.entries()).map(([user, uploads]) => ({ user, uploads }));
  }, [gallery]);

  const creatorsDisplay: CreatorRow[] =
    topCreators.length > 0 ? topCreators : uploadsAllTime;

  const resetLabel =
    scope === "weekly"
      ? "Weekly reset: every Saturday at 07:00 UTC+7"
      : scope === "daily"
      ? "Daily reset: every day at 07:00 UTC+7"
      : "All-Time";

  const headerTitle = (() => {
    if (scope === "alltime") return "🏆 Top Art (All Time)";
    if (!activeKey) return `🏆 Top Art (${scope} — current)`;
    if (scope === "daily") return `🏆 Top Art (daily — ${labelDaily(activeKey)})`;
    const info = labelWeekly(activeKey);
    return `🏆 Top Art (weekly — ${info.label})`;
  })();

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/gallery" className="btn">🖼️ Gallery</Link>
          <Link href="/submit" className="btn">＋ Submit</Link>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-xs opacity-70">{resetLabel}</span>
            {scope !== "alltime" && (
              <span className="text-sm font-semibold text-[#3aaefc]">Resets in {countdown}</span>
            )}
          </div>

          {/* Scope dropdown only */}
          <DarkDropdown
            label={scope === "daily" ? "Daily" : scope === "weekly" ? "Weekly" : "All Time"}
            items={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "alltime", label: "All Time" },
            ]}
            onSelect={(v) => {
              setScope(v as Scope);
              setActiveKey(null); // reset history when switching scope
            }}
          />

          {/* History chooser */}
          {scope !== "alltime" && (
            <HistoryChooser
              scope={scope}
              onPick={(k) => setActiveKey(k)}
              formatLabel={(k) => (scope === "daily" ? labelDaily(k) : labelWeekly(k).label)}
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
          {/* ===== Top Art ===== */}
          <section>
            <h2 className={heading}>{headerTitle}</h2>
            {topArts.length === 0 ? (
              <div className="opacity-70 text-sm mt-3">
                No data for this period yet. Try giving a ❤️ in the Gallery, then press Refresh.
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
                              // eslint-disable-next-line @next/next/no-img-element
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
                              <Link href={seeOnGallery} className="btn px-4 py-1 rounded-full text-sm">See on Gallery</Link>
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

          {/* ===== Top Creators (uploads) ===== */}
          <section>
            <h2 className={heading}>🧬 Top Creators (Top 10)</h2>
            {(creatorsDisplay?.length ?? 0) === 0 ? (
              <div className="opacity-70 text-sm mt-3">No uploads counted.</div>
            ) : (
              <div className="space-y-3">
                {creatorsDisplay
                  .slice(0, 50)
                  .sort((a, b) => b.uploads - a.uploads)
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
                              Uploads{scope !== "alltime" && topCreators.length > 0 ? " (period)" : ""}: {c.uploads}
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

/** ===== History chooser (loads period list lazily) ===== */
function HistoryChooser({
  scope,
  onPick,
  formatLabel,
}: {
  scope: "daily" | "weekly";
  onPick: (key: string) => void;
  formatLabel: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ value: string; label: string }[] | null>(null);

  async function ensure() {
    if (items) return;
    const r = await fetch(`/api/history/list?scope=${scope}`, { cache: "no-store" });
    const j = await r.json();
    const arr: string[] = j?.items || [];
    setItems(arr.map((k: string) => ({ value: k, label: formatLabel(k) })));
  }

  return (
    <div className="relative">
      <button
        onClick={async () => {
          await ensure();
          setOpen((o) => !o);
        }}
        className="px-4 py-1 rounded-full text-sm bg-gradient-to-r from-indigo-400/30 to-cyan-400/30 text-white shadow hover:brightness-110"
      >
        History <span className="opacity-80">▾</span>
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 min-w-[280px] max-h-[320px] overflow-auto rounded-lg border border-white/10 bg-black/85 backdrop-blur p-1 shadow-2xl"
          onMouseLeave={() => setOpen(false)}
        >
          {!items || items.length === 0 ? (
            <div className="px-3 py-2 text-sm text-white/60">No history yet.</div>
          ) : (
            items.map((it) => (
              <button
                key={it.value}
                onClick={() => { onPick(it.value); setOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-white/90 hover:bg-white/10"
              >
                {it.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
