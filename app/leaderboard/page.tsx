// app/leaderboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TopItem = { id: string; score: number };
type GalleryItem = { id: string; title: string; url: string; x?: string; discord?: string; createdAt: string; };
type LbResp = { success: boolean; topArts: TopItem[] };

function handleFromItem(it: GalleryItem): string {
  const x = (it.x || "").replace(/^@/, "");
  if (x) return `@${x}`;
  const d = (it.discord || "").replace(/^@/, "");
  return d ? `@${d}` : "";
}

export default function LeaderboardPage() {
  const [range, setRange] = useState<"daily" | "weekly">("daily");
  const [loading, setLoading] = useState(true);
  const [lb, setLb] = useState<LbResp | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  // --- util tombol ---
  // match exact style tombol "Submit/Gallery" dengan class "btn"
  const btnCTA = "btn px-4 py-1 rounded-full text-sm";
  // brand X color
  const btnX = "inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium transition shadow-sm bg-[#F6AAFF] text-black hover:brightness-110";

  async function load(currentRange: "daily" | "weekly") {
    setLoading(true);
    try {
      const r = await fetch(`/api/leaderboard?range=${currentRange}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      const normalized: LbResp = { success: !!j?.success, topArts: j?.topArts ?? j?.arts ?? [] };

      const g = await fetch(`/api/gallery`, { cache: "no-store" }).then((res) => res.json()).catch(() => ({}));
      const gItems: GalleryItem[] = g?.items ?? [];

      setLb(normalized);
      setGallery(gItems);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(range); }, [range]);

  const byId = useMemo(() => {
    const m = new Map<string, GalleryItem>();
    for (const it of gallery) m.set(it.id, it);
    return m;
  }, [gallery]);

  const uploadsByCreator = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of gallery) {
      const h = handleFromItem(it);
      if (!h) continue;
      m.set(h, (m.get(h) || 0) + 1);
    }
    return m;
  }, [gallery]);

  const topCreatorsFromUploads = useMemo(() => {
    const arr = Array.from(uploadsByCreator.entries()).map(([creator, score]) => ({ creator, score }));
    arr.sort((a, b) => b.score - a.score);
    return arr.slice(0, 10);
  }, [uploadsByCreator]);

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/gallery" className="btn">🖼️ Gallery</Link>
          <Link href="/submit" className="btn">＋ Submit</Link>
        </div>
        <div className="flex items-center gap-2">
          <select value={range} onChange={(e) => setRange(e.target.value as "daily" | "weekly")} className="btn">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <button onClick={() => load(range)} className="btn" disabled={loading}>
            ↻ {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-white/70">Loading…</p>
      ) : !lb?.success ? (
        <p className="text-white/70">Failed to load.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* === Top Art === */}
          <section>
            <h2 className="text-2xl font-bold mb-3">🏆 Top Art (Top 10)</h2>
            <div className="space-y-3">
              {lb.topArts.slice(0, 10).map((t, idx) => {
                const g = byId.get(t.id);
                const handle = g ? handleFromItem(g) : "";
                const handleNoAt = handle.replace(/^@/, "");
                const xUrl = handleNoAt ? `https://x.com/${handleNoAt}` : "";
                const seeOnGallery = `/gallery?select=${encodeURIComponent(t.id)}`;

                return (
                  <div key={t.id + idx} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 text-center opacity-70">{idx + 1}.</span>

                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/10 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {g ? <img src={g.url} alt={g.title} className="w-full h-full object-cover" loading="lazy" /> : null}
                      </div>

                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {g?.title || "Untitled"}
                          {handle && (
                            <>
                              {" "}<span className="opacity-70">by</span>{" "}
                              <a href={xUrl} target="_blank" rel="noopener noreferrer" className="underline">
                                {handle}
                              </a>
                            </>
                          )}
                        </div>

                        {/* UUID disembunyikan */}
                        {/* <div className="text-xs opacity-60 truncate">{t.id}</div> */}

                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link href={seeOnGallery} className={btnCTA}>See on Gallery</Link>
                          {handle && (
                            <a href={xUrl} target="_blank" rel="noopener noreferrer" className={btnX}>
                              Open X Profile
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-full bg-[#F6AAFF] text-black text-sm font-semibold">
                      {t.score}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* === Top Creators === */}
          <section>
            <h2 className="text-2xl font-bold mb-3">🧬 Top Creators (Top 10)</h2>
            <div className="space-y-3">
              {topCreatorsFromUploads.map((c, idx) => {
                const handle = c.creator.startsWith("@") ? c.creator : `@${c.creator}`;
                const galleryLink = `/gallery?q=${encodeURIComponent(handle)}`;
                const xUrl = `https://x.com/${handle.replace(/^@/, "")}`;

                return (
                  <div key={handle + idx} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 text-center opacity-70">{idx + 1}.</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{handle}</div>
                        <div className="text-xs opacity-60">Uploads: {c.score}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link href={galleryLink} className={btnCTA}>Search on Gallery</Link>
                          <a href={xUrl} target="_blank" rel="noopener noreferrer" className={btnX}>
                            Open X Profile
                          </a>
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#F6AAFF] text-black text-sm font-semibold">
                      {c.score}
                    </span>
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
