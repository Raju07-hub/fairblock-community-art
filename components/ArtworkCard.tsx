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
  onLike: (id: string) => void | Promise<void>;
}) {
  const [liked, setLiked] = useState(Boolean(item.liked));
  const [likes, setLikes] = useState(Number(item.likes || 0));
  const [pop, setPop] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleLike() {
    if (busy) return;
    setBusy(true);

    const next = !liked;
    // optimistic
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    if (next) {
      setPop(true);
      setTimeout(() => setPop(false), 480);
    }

    try {
      await onLike(item.id);
    } catch {
      // rollback bila gagal
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
      alert("Failed to like.");
    } finally {
      setBusy(false);
    }
  }

  const xHandle = item.x ? item.x.replace(/^@/, "") : "";

  return (
    <div className="glass rounded-2xl p-3 card-hover flex flex-col">
      {/* Gambar */}
      <div className="w-full h-56 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
        <img src={item.url} alt={item.title} className="w-full h-full object-contain" />
      </div>

      {/* Judul */}
      <h3 className="mt-3 font-semibold truncate">{item.title}</h3>

      {/* Baris tag + tombol like di kanan tag */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.x && (
          <button
            className="btn-ghost text-sm px-3 py-1"
            onClick={() => window.open(`https://x.com/${xHandle}`, "_blank")}
            title="Open X profile"
          >
            @{xHandle}
          </button>
        )}

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

        {/* ♥ Like — selalu muncul di baris ini */}
        <button
          onClick={handleLike}
          disabled={busy}
          aria-pressed={liked}
          className={`like-chip ${pop ? "like-pop" : ""}`}
          title={liked ? "Unlike" : "Like"}
        >
          <Heart className="heart" />
          <span className="text-sm">{likes}</span>
        </button>
      </div>
    </div>
  );
}
