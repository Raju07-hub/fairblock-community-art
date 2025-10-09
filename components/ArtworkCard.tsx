"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

type Artwork = {
  id: string;
  title: string;
  url: string;
  x?: string;
  discord?: string;
  likes?: number;   // total like dari server
  liked?: boolean;  // apakah user ini sudah like
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
  const [burst, setBurst] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleLike() {
    if (busy) return;
    setBusy(true);

    // Optimistic UI
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    if (next) {
      setBurst(true);
      setTimeout(() => setBurst(false), 600);
    }

    try {
      await onLike(item.id);
    } catch {
      // rollback kalau gagal
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
      alert("Failed to like.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-3 card-hover flex flex-col">
      {/* Gambar */}
      <div className="w-full h-56 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden relative">
        <img src={item.url} alt={item.title} className="w-full h-full object-contain" />
        {/* efek burst di atas tombol (posisi relatif ke kanan bawah baris bawah) */}
        {burst && (
          <span className="pointer-events-none absolute top-2 right-2 like-burst">
            <Heart className="w-6 h-6 like-burst-heart" />
          </span>
        )}
      </div>

      {/* Judul */}
      <h3 className="mt-3 font-semibold truncate">{item.title}</h3>

      {/* Bar bawah: kiri = tag, kanan = like */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {item.x && (
            <button
              className="btn-ghost text-sm px-3 py-1"
              onClick={() => {
                const handle = item.x ? item.x.replace(/^@/, "") : "";
                if (handle) window.open(`https://x.com/${handle}`, "_blank");
              }}
              title="Open X profile"
            >
              @{(item.x || "").replace(/^@/, "")}
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
        </div>

        {/* Tombol Like di sisi kanan baris tag */}
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
