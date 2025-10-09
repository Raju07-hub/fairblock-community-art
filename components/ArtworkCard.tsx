"use client";

import { useEffect, useState } from "react";
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
  onLike: (id: string) => Promise<void>;
}) {
  const [liked, setLiked] = useState(!!item.liked);
  const [likes, setLikes] = useState(Number(item.likes || 0));
  const [busy, setBusy] = useState(false);

  // sinkronkan ulang setiap kali parent update data (mis. setelah refresh)
  useEffect(() => {
    setLiked(!!item.liked);
    setLikes(Number(item.likes || 0));
  }, [item.liked, item.likes, item.id]);

  async function handleLike() {
    if (busy) return;
    setBusy(true);

    const next = !liked;
    // optimistic update
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));

    try {
      await onLike(item.id);
    } catch {
      // rollback jika gagal
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
      alert("Failed to like.");
    } finally {
      setBusy(false);
    }
  }

  // handle aman untuk X username
  const xHandle = item.x ? item.x.replace(/^@/, "") : null;

  return (
    <div className="glass rounded-2xl p-3 card-hover flex flex-col">
      <div className="w-full h-56 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
        <img
          src={item.url}
          alt={item.title}
          className="w-full h-full object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "data:image/svg+xml;charset=utf-8," +
              encodeURIComponent(
                `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><rect width='100%' height='100%' fill='#111'/><text x='50%' y='50%' fill='#bbb' dy='.3em' font-family='sans-serif' font-size='20' text-anchor='middle'>Image not available</text></svg>`
              );
          }}
        />
      </div>

      <h3 className="mt-3 font-semibold truncate">{item.title}</h3>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {xHandle && (
            <button
              className="btn-ghost text-sm px-3 py-1"
              onClick={() =>
                window.open(`https://x.com/${xHandle}`, "_blank")
              }
              title="Open X profile"
            >
              @{xHandle}
            </button>
          )}

          {item.discord && (
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(item.discord);
                  alert("Discord handle copied.");
                } catch {}
              }}
              className="btn-ghost text-sm px-3 py-1 underline"
              title="Copy Discord handle"
            >
              Copy Discord
            </button>
          )}
        </div>

        <button
          onClick={handleLike}
          disabled={busy}
          aria-pressed={liked}
          className={`badge-like-big ${liked ? "liked" : ""}`}
          title={liked ? "Unlike" : "Like"}
        >
          <Heart className={`w-5 h-5 ${liked ? "fill-current" : ""}`} />
          <span className="text-sm">{likes}</span>
        </button>
      </div>
    </div>
  );
}
