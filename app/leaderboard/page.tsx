// app/leaderboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TopItem = { id: string; score: number };
type TopCreator = { creator: string; score: number };

type GalleryItem = {
  id: string;
  title: string;
  url: string;
  x?: string;
  discord?: string;
  createdAt: string;
};

type LbResp = {
  success: boolean;
  topArts: TopItem[];
  topCreators: TopCreator[];
};

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/leaderboard?range=${range}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        const normalized: LbResp = {
          success: !!j?.success,
          topArts: j?.topArts ?? j?.arts ?? [],
          topCreators: j?.topCreators ?? j?.creators ?? [],
        };

        const g = await fetch(`/api/gallery`, { cache: "no-store" }).then((res) => res.json()).catch(() => ({}));
        const gItems: GalleryItem[] = g?.items ?? [];

        setLb(normalized);
        setGallery(gItems);
      } catch {
        setLb({ success: false, topArts: [], topCreators: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, [range]);

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

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/gallery" className="btn">🖼️ Gallery</Link>
          <Link href="/submit" className="btn">＋ Submit</Link>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as "daily" | "weekly")}
            className="btn"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <button onClick={() => setRange((r) => r)} className="btn">↻ Refresh</button>
        </div>
      </div>

      {loading ? (
        <p className="text-white/70">Loading…</p>
      ) : !lb?.success ? (
        <p className="text-white/70">Failed to load.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Art */}
          <section>
            <h2 className="text-2xl font-bold mb-3">🏆 Top Art (Top 10)</h2>
            <div className="space-y-3">
              {(lb.topArts ?? []).slice(0, 10).map((t, idx) => {
                const g = byId.get(t.id);
                return (
                  <div key={t.id + idx} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 text-center opacity-70">{idx + 1}.</span>
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/10 shrink-0">
                        {g ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={g.url} alt={g.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : <div className="w-full h-full" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{g?.title || t.id}</div>
                        <div className="text-xs opacity-60 truncate">{t.id}</div>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-pink-600/80 text-white text-sm">{t.score}</span>
                  </div>
                );
              })}
              {(lb.topArts ?? []).length === 0 && <div className="text-white/60">No results yet.</div>}
            </div>
          </section>

          {/* Top Creators */}
          <section>
            <h2 className="text-2xl font-bold mb-3">🧬 Top Creators (Top 10)</h2>
            <div className="space-y-3">
              {(lb.topCreators ?? []).slice(0, 10).map((c, idx) => {
                const handle = c.creator?.startsWith("@") ? c.creator : `@${c.creator}`;
                const uploads = uploadsByCreator.get(handle) || 0;
                const galleryLink = `/gallery?q=${encodeURIComponent(handle)}`;
                return (
                  <div key={handle + idx} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 text-center opacity-70">{idx + 1}.</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{handle}</div>
                        <div className="text-xs opacity-60">
                          Uploads: {uploads} · <Link href={galleryLink} className="underline">Search on Gallery</Link>
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-pink-600/80 text-white text-sm">{c.score}</span>
                  </div>
                );
              })}
              {(lb.topCreators ?? []).length === 0 && <div className="text-white/60">No creators yet.</div>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
