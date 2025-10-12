"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Scope = "weekly" | "monthly";
type TopItem = { id: string; likes?: number; title?: string; owner?: string; discord?: string; postUrl?: string; url?: string };
type CreatorUpload = { user: string; uploads: number };

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>("weekly");
  const [loading, setLoading] = useState(true);
  const [topArts, setTopArts] = useState<TopItem[]>([]);
  const [topCreators, setTopCreators] = useState<CreatorUpload[]>([]);

  const pill = (active: boolean) => `btn px-4 py-1 rounded-full text-sm ${active ? "bg-[#3aaefc]/30" : "bg-white/10"}`;
  const btn = "btn px-4 py-1 rounded-full text-sm";
  const badge = "px-3 py-1 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#3aaefc] to-[#4af2ff]";
  const heading = "text-2xl font-bold mb-3 text-[#3aaefc]";

  async function loadLB() {
    setLoading(true);
    try {
      const r = await fetch(`/api/leaderboard?range=${scope}`, { cache: "no-store" });
      const j = await r.json();
      setTopArts(j?.topArts || []);
      setTopCreators(j?.topCreatorsUploads || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLB(); }, [scope]);
  useEffect(() => {
    const t = setInterval(loadLB, 10000);
    return () => clearInterval(t);
  }, [scope]);

  const resetLabel =
    scope === "weekly"
      ? "Weekly reset: every Saturday at 07:00 UTC+7 (00:00 UTC)"
      : "Monthly reset: on the 1st at 07:00 UTC+7";

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/gallery" className="btn">🖼️ Gallery</Link>
          <Link href="/submit" className="btn">＋ Submit</Link>
          <Link href="/history" className="btn">🗂 History</Link>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs opacity-70">{resetLabel}</span>
          <div className="flex gap-2">
            <button className={pill(scope === "weekly")} onClick={() => setScope("weekly")}>Weekly</button>
            <button className={pill(scope === "monthly")} onClick={() => setScope("monthly")}>Monthly</button>
          </div>
          <button onClick={loadLB} className={btn} disabled={loading}>
            ↻ {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:[grid-template-columns:minmax(0,2.2fr)_minmax(0,1fr)] gap-6">
          {/* 🏆 Top Art */}
          <section>
            <h2 className={heading}>🏆 Top Art ({scope.toUpperCase()})</h2>
            <div className="space-y-3">
              {topArts.slice(0, 10).map((t, idx) => {
                const title = t.title ?? "Untitled";
                const xHandle = t.owner || "";
                const discord = t.discord || "";
                const seeOnGallery = `/gallery?select=${encodeURIComponent(t.id)}`;
                const xProfile = xHandle ? `https://x.com/${xHandle.replace(/^@/, "")}` : "";
                return (
                  <div key={t.id} className="flex items-center justify-between bg-white/5 rounded-xl p-5 md:p-6">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="w-7 text-center opacity-70">{idx + 1}.</span>
                      {t.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.url} alt={title} className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-2xl object-cover bg-white/10 shrink-0 shadow-md" loading="lazy" decoding="async" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate text-base">{title}</div>
                        <div className="mt-1 text-sm opacity-80 space-x-2">
                          {xHandle && <a className="underline hover:opacity-90" href={xProfile} target="_blank" rel="noopener noreferrer">{xHandle}</a>}
                          {discord && <span className="opacity-70">· {discord}</span>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link href={seeOnGallery} className={btn}>See on Gallery</Link>
                          {xHandle && <a href={xProfile} target="_blank" rel="noreferrer" className={btn}>Open X Profile</a>}
                        </div>
                      </div>
                    </div>
                    <span className={badge}>{t.likes ?? 0}</span>
                  </div>
                );
              })}
              {!topArts?.length && <div className="opacity-70">No data for this period yet.</div>}
            </div>
          </section>

          {/* 👨‍🎨 Top Creators by Uploads */}
          <section>
            <h2 className={heading}>🧬 Top Creators (by uploads)</h2>
            <div className="space-y-3">
              {topCreators.slice(0, 10).map((c, idx) => {
                const user = c.user;
                const galleryLink = `/gallery?q=${encodeURIComponent(user)}`;
                const xUrl = `https://x.com/${user.replace(/^@/, "")}`;
                return (
                  <div key={user} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 text-center opacity-70 text-sm">{idx + 1}.</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate text-[15px]">{user}</div>
                        <div className="text-xs opacity-60">Uploads: {c.uploads}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link href={galleryLink} className="btn px-3 py-1 rounded-full text-xs">Search on Gallery</Link>
                          <a href={xUrl} target="_blank" rel="noreferrer" className="btn px-3 py-1 rounded-full text-xs">Open X Profile</a>
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-[#3aaefc] to-[#4af2ff]">
                      {c.uploads}
                    </span>
                  </div>
                );
              })}
              {!topCreators.length && <div className="opacity-70">No creators yet.</div>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
