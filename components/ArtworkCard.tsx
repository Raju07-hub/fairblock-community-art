// /components/ArtworkCard.tsx
"use client";

import { useEffect, useState } from "react";
import { Heart, Search, Trash2, Pencil } from "lucide-react";
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

export default function ArtworkCard({
  item,
  onLike,
  onDeleted, // optional: biar parent bisa langsung remove dari list
}: {
  item: Artwork;
  onLike: (id: string) => Promise<void>;
  onDeleted?: (id: string) => void;
}) {
  const [liked, setLiked] = useState(!!item.liked);
  const [likes, setLikes] = useState(Number(item.likes || 0));
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  async function handleDelete() {
    if (deleting) return;
    if (!confirm("Delete this artwork?")) return;

    const token = getOwnerTokenFor(item.id) || "";
    setDeleting(true);
    try {
      const res = await fetch(`/api/delete?id=${encodeURIComponent(item.id)}`, {
        method: "POST",
        headers: { "x-owner-token": token },
      });
      const data = await res.json();
      if (data?.success) {
        onDeleted ? onDeleted(item.id) : router.refresh();
      } else {
        alert("Delete failed: " + (data?.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Delete error: " + (e?.message || "Network error"));
    } finally {
      setDeleting(false);
    }
  }

  const xHandle = item.x ? item.x.replace(/^@/, "") : null;
  const uploaderQuery = xHandle ? `@${xHandle}` : "";
  const isOwner = !!getOwnerTokenFor(item.id);

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

        {/* ❤️ LIKE BADGE */}
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
          <Heart className={`w-5 h-5 ${liked ? "fill-current text-red-600" : "text-red-500"}`} />
          <span className="text-sm font-medium">{likes}</span>
        </button>
      </div>

      <h3 className="mt-3 font-semibold truncate">{item.title}</h3>

      <div className="mt-2 flex items-center justify-between gap-3">
        {/* LEFT: Links/Actions */}
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

          {xHandle && (
            <button
              className="btn-ghost text-sm px-3 py-1 inline-flex items-center gap-1"
              title="Search this uploader on Gallery"
              onClick={() =>
                router.push(`/gallery?search=${encodeURIComponent(uploaderQuery)}`)
              }
            >
              <Search className="w-4 h-4" />
              Search on Gallery
            </button>
          )}
        </div>

        {/* RIGHT: Owner-only controls */}
        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost text-sm px-2 py-1 inline-flex items-center gap-1"
              onClick={() => router.push(`/edit/${encodeURIComponent(item.id)}`)}
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              className="btn-ghost text-sm px-2 py-1 inline-flex items-center gap-1 text-red-500"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
