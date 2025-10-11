// app/gallery/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type GalleryItem = {
  id: string;
  title: string;
  url: string;
  x?: string;
  discord?: string;
  createdAt: string;
  metaUrl: string;
  postUrl?: string; // ← NEW: open art post
};

type LikeMap = Record<
  string,
  {
    count: number;
    liked: boolean;
  }
>;

const btn = "btn px-4 py-1 rounded-full text-sm";
const pill = "btn px-3 py-1 rounded-full text-xs";
const counter =
  "flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-white/90";

function normHandle(x?: string) {
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

function setOwnerTokenFor(id: string, token: string) {
  try {
    const raw = localStorage.getItem("fairblock:tokens");
    const map = raw ? JSON.parse(raw) : {};
    map[id] = token;
    localStorage.setItem("fairblock:tokens", JSON.stringify(map));
  } catch {}
}

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [likes, setLikes] = useState<LikeMap>({});
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [loading, setLoading] = useState(true);

  // load gallery
  async function load() {
    setLoading(true);
    try {
      const j = await fetch("/api/gallery", { cache: "no-store" }).then((r) =>
        r.json()
      );
      const list: GalleryItem[] = j?.items || [];
      setItems(list);

      if (list.length) {
        const ids = list.map((i) => i.id).join(",");
        const liked = await fetch(`/api/likes?ids=${ids}`, {
          cache: "no-store",
        }).then((r) => r.json());
        setLikes(liked?.data || {});
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // like/unlike
  async function toggleLike(it: GalleryItem) {
    const body = { id: it.id, author: normHandle(it.x || it.discord || "") };
    const j = await fetch("/api/like", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }).then((r) => r.json());
    if (j?.success) {
      setLikes((prev) => ({
        ...prev,
        [it.id]: { count: j.count ?? 0, liked: !!j.liked },
      }));
    }
  }

  // delete
  async function onDelete(it: GalleryItem) {
    const token = getOwnerTokenFor(it.id);
    if (!token) return alert("Delete token not found for this artwork.");
    if (!confirm("Delete this artwork?")) return;

    const j = await fetch(`/api/art/${it.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, metaUrl: it.metaUrl }),
    }).then((r) => r.json());
    if (j?.success) {
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } else {
      alert(j?.error || "Delete failed");
    }
  }

  // helper: apakah viewer adalah owner (punya token lokal)
  function isOwner(it: GalleryItem) {
    return !!getOwnerTokenFor(it.id);
  }

  // filter
  const filtered = useMemo(() => {
    let list = items;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((it) => {
        const h = [it.title, it.x, it.discord].join(" ").toLowerCase();
        return h.includes(q);
      });
    }
    if (onlyMine) {
      list = list.filter((it) => isOwner(it));
    }
    return list;
  }, [items, query, onlyMine]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link href="/" className="btn">
          ← Back Home
        </Link>
        <Link href="/submit" className="btn">
          + Submit Art
        </Link>
        <Link href="/leaderboard" className="btn">
          🏆 Leaderboard
        </Link>

        <div className="flex-1" />
        <button onClick={load} className="btn">
          ↻ Refresh
        </button>
      </div>

      {/* Search & filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title / @x / discord…"
          className="w-full sm:w-96 px-4 py-2 rounded-xl bg-white/10 outline-none"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
          />
          Only My Uploads
        </label>
      </div>

      <h1 className="text-2xl font-bold mb-4">Gallery</h1>

      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : (
        <>
          <p className="opacity-70 mb-3">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((it) => {
              const like = likes[it.id] || { count: 0, liked: false };
              const handle = normHandle(it.x || it.discord || "");
              const xUrl =
                it.x && handle
                  ? `https://x.com/${handle.replace(/^@/, "")}`
                  : "";
              const openPost =
                it.postUrl &&
                /^https?:\/\/(x\.com|twitter\.com)\//i.test(it.postUrl)
                  ? it.postUrl
                  : "";

              return (
                <div
                  key={it.id}
                  className="rounded-2xl overflow-hidden bg-white/5 shadow-lg"
                >
                  {/* Image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.url}
                    alt={it.title}
                    className="w-full aspect-[4/3] object-cover"
                    loading="lazy"
                    decoding="async"
                  />

                  {/* Body */}
                  <div className="p-4">
                    <div className="font-semibold">{it.title || "Untitled"}</div>

                    <div className="mt-1 text-sm text-white/70 flex items-center gap-2">
                      {it.x && (
                        <a
                          className="underline"
                          href={xUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {normHandle(it.x)}
                        </a>
                      )}
                      {it.discord && (
                        <>
                          <span>·</span>
                          <span>{normHandle(it.discord)}</span>
                        </>
                      )}
                    </div>

                    {/* Actions row */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/gallery?select=${encodeURIComponent(it.id)}`}
                        className={pill}
                      >
                        See on Gallery
                      </Link>

                      {openPost && (
                        <a
                          href={openPost}
                          className={pill}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Art Post
                        </a>
                      )}

                      {it.discord && (
                        <button
                          className={pill}
                          onClick={() =>
                            navigator.clipboard.writeText(it.discord!)
                          }
                        >
                          Copy Discord
                        </button>
                      )}

                      <button
                        className={counter}
                        onClick={() => toggleLike(it)}
                        title={like.liked ? "Unlike" : "Like"}
                      >
                        <span>💙</span>
                        <span>{like.count}</span>
                      </button>

                      {/* Owner controls */}
                      {isOwner(it) && (
                        <>
                          <Link
                            href={`/edit/${it.id}`}
                            className={pill}
                            title="Edit this artwork"
                          >
                            ✏️ Edit
                          </Link>
                          <button
                            className={pill}
                            onClick={() => onDelete(it)}
                            title="Delete this artwork"
                          >
                            🗑 Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
