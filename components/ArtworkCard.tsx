// components/ArtworkCard.tsx
"use client";
import { useEffect, useState } from "react";
import { getAnonId } from "@/lib/anon";

export default function ArtworkCard({ item }: { item: any }) {
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const userId = getAnonId();

  useEffect(() => {
    fetch(`/api/like?id=${item.id}&user=${userId}`)
      .then(r => r.json())
      .then(d => { setLikes(d.count || 0); setLiked(!!d.liked); });
  }, [item.id, userId]);

  async function likeOnce() {
    if (liked) return;
    const res = await fetch("/api/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artId: item.id, userId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Like error:", res.status, data);
      alert(data?.error || "Failed to like.");
      return;
    }
    setLikes(data.count ?? likes + 1);
    setLiked(true);
  }

  return (
    <div className="card p-3 relative">
      {/* gambar + judulmu */}
      <img src={item.fileUrl} alt={item.title} className="rounded-xl w-full aspect-[4/3] object-cover" />
      <div className="mt-3 font-semibold">{item.title}</div>

      {/* ACTION ROW */}
      <div className="mt-2 flex items-center gap-2">
        {/* contoh tombol open X / copy discord milikmu... */}
        {item.x && (
          <a href={item.x} target="_blank" className="px-3 py-1 rounded-full bg-slate-700 hover:bg-slate-600 text-sm">
            Open X ↗
          </a>
        )}
        <button
          onClick={() => navigator.clipboard.writeText(item.discord || "")}
          className="px-3 py-1 rounded-full bg-slate-700 hover:bg-slate-600 text-sm"
        >
          Copy Discord
        </button>

        {/* ❤️ LIKE — di sisi kanan action row */}
        <button
          onClick={likeOnce}
          disabled={liked}
          className={`ml-auto px-2.5 py-1 rounded-full flex items-center gap-1 text-sm
            ${liked ? "bg-pink-600/60 cursor-not-allowed text-white" : "bg-pink-600 hover:bg-pink-500 text-white"}`}
          title={liked ? "Liked" : "Like"}
        >
          ❤️ <span className="min-w-5 text-center">{likes}</span>
        </button>
      </div>
    </div>
  );
}
