"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Artwork = {
  id: string;
  title: string;
  url: string;
  x?: string;
  discord?: string;
  postUrl?: string; // ← NEW
  metaUrl?: string;
  createdAt?: string;
};

export default function GalleryPage() {
  const [items, setItems] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function loadGallery() {
    setLoading(true);
    const res = await fetch("/api/gallery", { cache: "no-store" });
    const j = await res.json();
    setItems(j?.items ?? []);
    setLoading(false);
  }

  async function handleDelete(metaUrl: string, id: string) {
    const token = localStorage.getItem(`deleteToken:${id}`);
    if (!token) {
      alert("Missing owner token.");
      return;
    }
    if (!confirm("Are you sure you want to delete this artwork?")) return;
    const res = await fetch(`/api/art/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, metaUrl }),
    });
    const j = await res.json();
    if (j?.success) {
      alert("Deleted successfully.");
      loadGallery();
    } else {
      alert("Delete failed: " + j?.error);
    }
  }

  useEffect(() => {
    loadGallery();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/leaderboard" className="btn">🏆 Leaderboard</Link>
          <Link href="/submit" className="btn">＋ Submit</Link>
        </div>
        <button onClick={loadGallery} className="btn" disabled={loading}>
          ↻ {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <p className="opacity-70">Loading gallery…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {items.map((item) => {
            const isOwner =
              typeof window !== "undefined" &&
              !!localStorage.getItem(`deleteToken:${item.id}`);

            const xProfile = item.x
              ? `https://x.com/${item.x.replace(/^@/, "")}`
              : "";

            return (
              <div
                key={item.id}
                className={`bg-white/5 rounded-xl p-4 flex flex-col shadow-md hover:bg-white/10 transition`}
              >
                {/* image */}
                <div className="rounded-xl overflow-hidden mb-3 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.title}
                    className="w-full h-60 object-cover transition-transform duration-300 hover:scale-105"
                    loading="lazy"
                  />
                </div>

                {/* info */}
                <div className="flex flex-col flex-1 justify-between">
                  <div>
                    <div className="font-semibold text-lg truncate mb-1">{item.title}</div>
                    <div className="text-sm opacity-80 space-x-2">
                      {item.x && (
                        <a
                          href={xProfile}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-[#4af2ff]"
                        >
                          {item.x}
                        </a>
                      )}
                      {item.discord && (
                        <span className="opacity-70">· {item.discord}</span>
                      )}
                    </div>
                  </div>

                  {/* buttons */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/gallery?select=${encodeURIComponent(item.id)}`}
                      className="btn px-3 py-1 rounded-full text-sm"
                    >
                      Permalink
                    </Link>

                    {item.postUrl && (
                      <a
                        href={item.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn px-3 py-1 rounded-full text-sm"
                      >
                        Open Art Post
                      </a>
                    )}

                    {isOwner && (
                      <>
                        <button
                          onClick={() => handleDelete(item.metaUrl!, item.id)}
                          className="btn px-3 py-1 rounded-full text-sm bg-red-500/50 hover:bg-red-500/70"
                        >
                          Delete
                        </button>
                        <Link
                          href={`/edit/${item.id}`}
                          className="btn px-3 py-1 rounded-full text-sm bg-yellow-400/30 hover:bg-yellow-400/50"
                        >
                          Edit
                        </Link>
                      </>
                    )}
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
