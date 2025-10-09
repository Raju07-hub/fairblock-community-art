"use client";
import { useState } from "react";
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
  onLike: (id: string) => Promise<{ liked: boolean; count: number }>;
}) {
  const [liked, setLiked] = useState(Boolean(item.liked));
  const [likes, setLikes] = useState(Number(item.likes || 0));
  const [burst, setBurst] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleLike() {
    if (busy) return;
    setBusy(true);

    // Optimistic
    const next = !liked;
    const rollbackLikes = likes;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    if (next) {
      setBurst(true);
      setTimeout(() => setBurst(false), 600);
    }

    try {
      const res = await onLike(item.id);
      // sinkron dengan angka server agar pas refresh & antar browser konsisten
      setLiked(res.liked);
      setLikes(res.count);
    } catch {
      // rollback bila gagal
      setLiked(!next);
      setLikes(rollbackLikes);
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
          {item.x ? (
            <button
              className="btn-ghost text-sm px-3 py-1"
              onClick={() => window.open(`https://x.com/${(item.x || "").replace(/^@/, "")}`, "_blank")}
              title="Open X profile"
            >
              @{(item.x || "").replace(/^@/, "")}
            </button>
          ) : null}

          {item.discord && (
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(item.discord!);
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

        <div className="relative">
          {burst && (
            <span className="pointer-events-none absolute -top-5 right-1 like-burst">
              <Heart className="w-6 h-6 like-burst-heart" />
            </span>
          )}

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
    </div>
  );
}
