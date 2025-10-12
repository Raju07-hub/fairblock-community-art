"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Scope = "weekly" | "monthly";
type TopItem = { id: string; score?: number; likes?: number; title?: string; owner?: string; discord?: string; postUrl?: string; url?: string; };
type GalleryItem = { id: string; title: string; url: string; x?: string; discord?: string; metaUrl?: string; postUrl?: string };

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>("weekly");
  const [loading, setLoading] = useState(true);
  const [topArts, setTopArts] = useState<TopItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  const pill = (active: boolean) => `btn px-4 py-1 rounded-full text-sm ${active ? "bg-[#3aaefc]/30" : "bg-white/10"}`;
  const btn = "btn px-4 py-1 rounded-full text-sm";
  const badge = "px-3 py-1 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#3aaefc] to-[#4af2ff]";
  const heading = "text-2xl font-bold mb-3 text-[#3aaefc]";

  async function loadLB() {
    setLoading(true);
    try {
      const r = await fetch(`/api/leaderboard?range=${scope}`, { cache: "no-store" });
      const j = await r.json();
      setTopArts((j?.topArts || []).map((x: any) => ({ id: x.id, likes: x.score })));
    } finally {
      setLoading(false);
    }
  }
  async function loadGallery() {
    try {
      const r = await fetch(`/api/gallery`, { cache: "no-store" });
      const j = await r.json();
      setGallery(j?.items || []);
    } catch {}
  }

  useEffect(() => { loadGallery(); }, []);
  useEffect(() => { loadLB(); /* eslint-disable-next-line */ }, [scope]);

  // realtime polling 10s
  useEffect(() => {
    const t = setInterval(loadLB, 10000);
    return () => clearInterval(t);
  }, [scope]);

  // join metadata
  const rows = useMemo(() => {
    const map = new Map(gallery.map(g => [g.id, g]));
    return topArts.map(t => {
      const g = map.get(t.id);
      return {
        ...t,
        title: g?.title || t.title || "Untitled",
        url: g?.url || t.url,
        owner: g?.x || t.owner,
        discord: g?.discord || t.discord,
        postUrl: g?.postUrl || t.postUrl,
      };
    });
  }, [topArts, gallery]);

  // creators by uploads
  const topCreators = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of gallery) {
      const handle = (it.x || "").trim();
      if (!handle) continue;
      const key = handle.startsWith("@") ? handle : `@${handle}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([user, uploads]) => ({ user, uploads }))
      .sort((a, b) => b.uploads - a.uploads)
      .slice(0, 10);
  }, [gallery]);

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
          {/* Top Art */}
          <section>
            <h2 className={heading}>🏆 Top Art ({scope.toUpperCase()})</h2>
            <div className="space-y-3">
              {rows.slice(0, 10).map((t, idx) => {
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
              {!rows?.length && <div className="opacity-70">No data for this period yet.</div>}
            </div>
          </section>

          {/* Top Creators */}
          <section>
            <h2 className={heading}>🧬 Top Creators (by uploads)</h2>
            <div className="space-y-3">
              {topCreators.map((c, idx) => {
                const galleryLink = `/gallery?q=${encodeURIComponent(c.user)}`;
                const xUrl = `https://x.com/${c.user.replace(/^@/, "")}`;
                return (
                  <div key={c.user} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 text-center opacity-70 text-sm">{idx + 1}.</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate text-[15px]">{c.user}</div>
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
