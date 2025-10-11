"use client";

import { useEffect, useState } from "react";
import { Heart, Search } from "lucide-react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  useEffect(() => {
    setLiked(!!item.liked);
    setLikes(Number(item.likes || 0));
  }, [item.id, item.liked, item.likes]);

  async function handleLike() {
    if (busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      await onLike(item.id);
    } catch {
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
      alert("Failed to like.");
    } finally {
      setBusy(false);
    }
  }

  const xHandle = item.x ? item.x.replace(/^@/, "") : null;
  const uploaderQuery = xHandle ? `@${xHandle}` : "";

  return (
    <div className="glass rounded-2xl p-3 card-hover flex flex-col">
      {/* IMAGE WRAPPER */}
      <div className="relative w-full h-56 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
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

        {/* ❤️ LIKE BADGE — overlay kanan-atas (area yang kamu coret) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleLike();
          }}
          disabled={busy}
          aria-pressed={liked}
          title={liked ? "Unlike" : "Like"}
          className={`absolute top-2 right-2 select-none inline-flex items-center gap-1 rounded-full px-3 py-1.5 shadow-md backdrop-blur
            ${liked ? "bg-white text-red-600" : "bg-black/50 text-white hover:bg-black/60"}`}
        >
          <Heart
            className={`w-5 h-5 ${
              liked ? "fill-current text-red-600" : "text-red-500"
            }`}
          />
          <span className="text-sm font-medium">{likes}</span>
        </button>
      </div>

      <h3 className="mt-3 font-semibold truncate">{item.title}</h3>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {xHandle && (
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
                const handle = item.discord;
                if (!handle) return;
                try {
                  await navigator.clipboard.writeText(handle);
                  alert("Discord handle copied.");
                } catch {}
              }}
              className="btn-ghost text-sm px-3 py-1 underline"
              title="Copy Discord handle"
            >
              Copy Discord
            </button>
          )}

          {/* 🔎 SEARCH ON GALLERY -> /gallery?search=@username */}
          {xHandle && (
            <button
              className="btn-ghost text-sm px-3 py-1 inline-flex items-center gap-1"
              title="Search this uploader on Gallery"
              onClick={() => router.push(`/gallery?search=${encodeURIComponent(uploaderQuery)}`)}
            >
              <Search className="w-4 h-4" />
              Search on Gallery
            </button>
          )}
        </div>
        {/* (badge like dipindah ke overlay atas, jadi area kanan-bawah dibiarkan kosong / bisa isi lain) */}
        <div />
      </div>
    </div>
  );
}
