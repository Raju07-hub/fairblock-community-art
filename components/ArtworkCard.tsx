"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";

type Artwork = {
  id: string;
  title: string;
  url: string;
  x?: string;
  discord?: string;
  likes?: number;
  liked?: boolean;
};

export default function ArtworkCard({
  item,
  onLike,
}: {
  item: Artwork;
  onLike: (id: string) => Promise<{ liked?: boolean; count?: number } | void> | void;
}) {
  // inisialisasi dari server + fallback localStorage agar tak “hilang” saat reload
  const [liked, setLiked] = useState(Boolean(item.liked));
  const [likes, setLikes] = useState(Number(item.likes || 0));
  const [burst, setBurst] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (!liked) {
        const l = localStorage.getItem(`liked:${item.id}`) === "1";
        if (l) setLiked(true);
      }
    } catch {}
  }, [item.id, liked]);

  async function handleLike() {
    if (busy || liked) return;   // 1 like per browser (no toggle back)
    setBusy(true);

    // Optimistic
    setLiked(true);
    setLikes((n) => n + 1);
    setBurst(true);
    setTimeout(() => setBurst(false), 600);

    try {
      const res = (await onLike(item.id)) || {};
      if (typeof (res as any).count === "number") setLikes((res as any).count);
      if (typeof (res as any).liked === "boolean") setLiked(Boolean((res as any).liked));
      try { localStorage.setItem(`liked:${item.id}`, "1"); } catch {}
    } catch {
      // rollback kalau gagal
      setLiked(false);
      setLikes((n) => Math.max(0, n - 1));
      alert("Failed to like.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-3 card-hover flex flex-col">
      <div className="w-full h-56 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
        <img src={item.url} alt={item.title} className="w-full h-full object-contain" />
      </div>

      <h3 className="mt-3 font-semibold truncate">{item.title}</h3>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {!!item.x && (
            <button
              className="btn-ghost text-sm px-3 py-1"
              onClick={() => window.open(`https://x.com/${item.x!.replace(/^@/, "")}`, "_blank")}
              title="Open X profile"
            >
              @{item.x!.replace(/^@/, "")}
            </button>
          )}
          {!!item.discord && (
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(item.discord!); alert("Discord handle copied."); } catch {}
              }}
              className="btn-ghost text-sm px-3 py-1 underline"
              title="Copy Discord handle"
            >
              Copy Discord
            </button>
          )}
        </div>

        <div className="relative">
          {burst && (
            <span className="pointer-events-none absolute -top-5 right-1 like-burst">
              <Heart className="w-6 h-6 like-burst-heart" />
            </span>
          )}
          <button
            onClick={handleLike}
            disabled={busy || liked}
            aria-pressed={liked}
            className={`badge-like-big ${liked ? "liked" : ""}`}
            title={liked ? "Liked" : "Like"}
          >
            <Heart className={`w-5 h-5 ${liked ? "fill-current" : ""}`} />
            <span className="text-sm">{likes}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
