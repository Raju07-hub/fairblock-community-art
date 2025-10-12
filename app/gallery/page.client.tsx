"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Heart, X, ChevronLeft, ChevronRight } from "lucide-react";

type GalleryItem = {
  id: string;
  title: string;
  url: string;
  x?: string;
  discord?: string;
  createdAt: string;
  metaUrl: string;
  postUrl?: string;
};

type LikeMap = Record<string, { count: number; liked: boolean }>;

function at(x?: string) {
  if (!x) return "";
  return x.startsWith("@") ? x : `@${x}`;
}
function getOwnerTokenFor(id: string): string | null {
  try {
    const raw = localStorage.getItem("fairblock:tokens");
    if (!raw) return null;
    const map = JSON.parse(raw || "{}");
    return map?.[id] || null;
  } catch {
    return null;
  }
}

async function copyTextForce(text: string) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function GalleryClient() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [likes, setLikes] = useState<LikeMap>({});
  const [loading, setLoading] = useState(true);

  const searchParams = useSearchParams();

  async function load() {
    setLoading(true);
    try {
      const j = await fetch(`/api/gallery`, { cache: "no-store" }).then((r) => r.json());
      setItems(j?.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleLike(it: GalleryItem) {
    const author = at(it.x) || at(it.discord);
    const j = await fetch("/api/like", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: it.id, author }),
    }).then((r) => r.json());
    if (j?.success) {
      setLikes((prev) => ({ ...prev, [it.id]: { count: j.count ?? 0, liked: !!j.liked } }));
    }
  }

  // ✅ Fixed deep-link auto-scroll (no TS error)
  useEffect(() => {
    const sel = searchParams.get("select");
    if (!sel || !items.length) return;

    const apply = () => {
      const el = document.getElementById(`art-${sel}`);
      if (!el) return null;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-sky-400");
      const tid = window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-sky-400");
      }, 2500);
      return () => window.clearTimeout(tid);
    };

    let cleanup: (() => void) | null = apply();
    let retryTimer: number | null = null;
    if (!cleanup) {
      retryTimer = window.setTimeout(() => {
        cleanup = apply();
      }, 60);
    }

    return () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (cleanup) cleanup();
    };
  }, [searchParams, items]);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-3">
          <Link href="/" className="btn">
            ⬅ Back Home
          </Link>
          <Link href="/submit" className="btn">
            ＋ Submit Art
          </Link>
          <Link href="/leaderboard" className="btn">
            🏆 Leaderboard
          </Link>
        </div>

        <button onClick={load} className="btn">
          ↻ {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-4">Gallery</h1>

      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((it) => {
            const like = likes[it.id] || { count: 0, liked: false };
            const openPost =
              it.postUrl && /^https?:\/\/(x\.com|twitter\.com)\//i.test(it.postUrl) ? it.postUrl : "";

            return (
              <div
                key={it.id}
                id={`art-${it.id}`} // penting untuk auto-scroll
                className="glass rounded-2xl overflow-hidden card-hover transition transform hover:scale-[1.02]"
              >
                <div className="relative">
                  <img
                    src={it.url}
                    alt={it.title}
                    className="w-full aspect-[4/3] object-contain bg-black/20"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(it);
                    }}
                    className={`absolute top-2 right-2 flex items-center gap-1 px-3 py-1 rounded-full ${
                      like.liked ? "bg-white text-red-600" : "bg-black/50 text-white"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${like.liked ? "fill-current" : ""}`} />
                    <span className="text-sm">{like.count}</span>
                  </button>
                </div>

                <div className="p-4">
                  <div className="font-semibold truncate">{it.title}</div>
                  <div className="text-sm text-white/70 mt-1">
                    {it.x && <span>{it.x}</span>}
                    {it.discord && <span> · {it.discord}</span>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/gallery?select=${it.id}`} className="btn px-3 py-1 text-xs">
                      See on Gallery
                    </Link>
                    {openPost && (
                      <a href={openPost} target="_blank" rel="noreferrer" className="btn px-3 py-1 text-xs">
                        Open Art Post
                      </a>
                    )}
                    <button
                      className="btn px-3 py-1 text-xs"
                      onClick={async () => {
                        const ok = await copyTextForce(it.discord || it.x || "");
                        alert(ok ? "Copied!" : "Copy failed.");
                      }}
                    >
                      Copy Discord
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
