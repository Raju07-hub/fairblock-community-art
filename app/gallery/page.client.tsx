"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";

type GalleryItem = {
  id: string;
  title: string;
  url: string;
  x?: string;
  discord?: string;
  createdAt: string;
  metaUrl: string;
  postUrl?: string;
};

type LikeMap = Record<string, { count: number; liked: boolean }>;

function at(x?: string) {
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

async function copyTextForce(text: string) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function GalleryClient() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [likes, setLikes] = useState<LikeMap>({});
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  async function load() {
    setLoading(true);
    try {
      const j = await fetch("/api/gallery", { cache: "no-store" }).then(r => r.json());
      const list: GalleryItem[] = j?.items || [];
      setItems(list);

      if (list.length) {
        const ids = list.map(i => i.id).join(",");
        const liked = await fetch(`/api/likes?ids=${ids}`, { cache: "no-store" }).then(r => r.json());
        setLikes(liked?.data || {});
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function toggleLike(it: GalleryItem) {
    const author = at(it.x) || at(it.discord);
    const j = await fetch("/api/like", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: it.id, author }),
    }).then(r => r.json());
    if (j?.success) {
      setLikes(prev => ({ ...prev, [it.id]: { count: j.count ?? 0, liked: !!j.liked } }));
    }
  }

  async function onDelete(it: GalleryItem) {
    const token = getOwnerTokenFor(it.id);
    if (!token) return alert("Delete token not found. Use the same browser you used to submit.");
    if (!confirm("Delete this artwork?")) return;

    const j = await fetch(`/api/art/${it.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, metaUrl: it.metaUrl }),
    }).then(r => r.json());

    if (j?.success) setItems(prev => prev.filter(x => x.id !== it.id));
    else alert(j?.error || "Delete failed");
  }

  const filtered = useMemo(() => {
    let list = items;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(it =>
        [it.title, it.x, it.discord].join(" ").toLowerCase().includes(q)
      );
    }
    if (onlyMine) list = list.filter(it => !!getOwnerTokenFor(it.id));
    list = list
      .slice()
      .sort((a, b) =>
        sort === "newest"
          ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    return list;
  }, [items, query, onlyMine, sort]);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      {/* actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/submit" className="btn">＋ Submit Art</Link>
          <Link href="/leaderboard" className="btn">🏆 Leaderboard</Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search title / @x / discord..."
            className="px-4 py-2 rounded-full bg-white/10 outline-none w-56"
          />

          {/* Newest / Older */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as "newest" | "oldest")}
            className="px-3 py-2 rounded-full bg-white/10 text-white text-sm outline-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Older</option>
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={e => setOnlyMine(e.target.checked)}
            />
            Only My Uploads
          </label>

          <button onClick={load} className="btn">
            ↻ {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-4">Gallery</h1>

      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="opacity-70">No artworks found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map(it => {
            const like = likes[it.id] || { count: 0, liked: false };
            const xHandle = at(it.x);
            const discordName = (it.discord || "").replace(/^@/, "");
            const xUrl = xHandle ? `https://x.com/${xHandle.replace(/^@/, "")}` : "";
            const openPost = it.postUrl && /^https?:\/\/(x\.com|twitter\.com)\//i.test(it.postUrl) ? it.postUrl : "";
            const queryKey = xHandle || discordName || it.title;
            const isOwner = !!getOwnerTokenFor(it.id);

            return (
              <div key={it.id} className="glass rounded-2xl overflow-hidden card-hover">
                {/* ==== GAMBAR: setelan seperti dulu ==== */}
                <div className="relative">
                  <img
                    src={it.url}
                    alt={it.title}
                    className="w-full aspect-[4/3] object-cover"
                  />
                  {/* gradient gelap halus di bawah gambar (seperti versi lama) */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
                  {/* ❤️ badge kanan-atas */}
                  <button
                    onClick={() => toggleLike(it)}
                    aria-pressed={like.liked}
                    title={like.liked ? "Unlike" : "Like"}
                    className={`absolute top-2 right-2 flex items-center gap-1 px-3 py-1 rounded-full transition backdrop-blur-sm ${
                      like.liked ? "bg-white text-red-600" : "bg-black/50 text-white hover:bg-black/70"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${like.liked ? "fill-current" : ""}`} />
                    <span className="text-sm">{like.count}</span>
                  </button>
                </div>

                {/* ==== INFO + BUTTONS (jangan diubah) ==== */}
                <div className="p-4">
                  <div className="font-semibold truncate">{it.title}</div>
                  <div className="text-sm text-white/70 mt-1">
                    {xHandle && (
                      <a href={xUrl} target="_blank" rel="noreferrer" className="underline text-sky-300">
                        {xHandle}
                      </a>
                    )}
                    {discordName && (
                      <>
                        <span> · </span>
                        <span>{discordName}</span>
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="btn px-3 py-1 text-xs"
                      onClick={() => {
                        const target = queryKey || "";
                        setQuery(target);
                      }}
                    >
                      Search on Gallery
                    </button>

                    {openPost && (
                      <a
                        href={openPost}
                        target="_blank"
                        rel="noreferrer"
                        className="btn px-3 py-1 text-xs"
                      >
                        Open Art Post
                      </a>
                    )}

                    <button
                      className="btn px-3 py-1 text-xs"
                      onClick={async () => {
                        const ok = await copyTextForce(discordName || xHandle || "");
                        alert(ok ? "Copied!" : "Copy failed.");
                      }}
                    >
                      Copy Discord
                    </button>
                  </div>

                  {isOwner && (
                    <div className="mt-3 flex gap-2">
                      <Link href={`/edit/${it.id}`} className="btn px-3 py-1 text-xs bg-white/10">✏️ Edit</Link>
                      <button onClick={() => onDelete(it)} className="btn px-3 py-1 text-xs bg-red-500/30">🗑 Delete</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
