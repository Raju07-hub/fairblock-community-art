"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
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

const brandGradient = "from-[#3aaefc] to-[#4af2ff]";

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

export default function GalleryClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialSearch =
    (searchParams.get("search") || searchParams.get("q") || "").trim();

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [likes, setLikes] = useState<LikeMap>({});
  const [query, setQuery] = useState(initialSearch);
  const [onlyMine, setOnlyMine] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const j = await fetch("/api/gallery", { cache: "no-store" }).then((r) => r.json());
      const list: GalleryItem[] = j?.items || [];
      setItems(list);

      if (list.length) {
        const ids = list.map((i) => i.id).join(",");
        const liked = await fetch(`/api/likes?ids=${ids}`, { cache: "no-store" }).then((r) => r.json());
        setLikes(liked?.data || {});
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Sinkronkan input -> URL (?search=)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const curr = sp.get("search") || "";
    if (query !== curr) {
      if (query) sp.set("search", query);
      else sp.delete("search");
      sp.delete("q"); // bersihkan param lama
      router.replace(`/gallery?${sp.toString()}`);
    }
  }, [query, router]);

  async function toggleLike(it: GalleryItem) {
    const author = at(it.x) || at(it.discord);
    const j = await fetch("/api/like", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: it.id, author }),
    }).then((r) => r.json());

    if (j?.success) {
      setLikes((prev) => ({ ...prev, [it.id]: { count: j.count ?? 0, liked: !!j.liked } }));
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
    }).then((r) => r.json());

    if (j?.success) {
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } else {
      alert(j?.error || "Delete failed");
    }
  }

  const filtered = useMemo(() => {
    let list = items;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((it) => {
        const h = [it.title, it.x, it.discord].join(" ").toLowerCase();
        return h.includes(q);
      });
    }
    if (onlyMine) list = list.filter((it) => !!getOwnerTokenFor(it.id));
    return list;
  }, [items, query, onlyMine]);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/submit" className="btn">＋ Submit Art</Link>
          <Link href="/leaderboard" className="btn">🏆 Leaderboard</Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title / @x / discord..."
            className="px-4 py-2 rounded-xl bg-white/10 outline-none w-56"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Only My Uploads
          </label>
          <button onClick={load} className="btn">↻ {loading ? "Refreshing…" : "Refresh"}</button>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-4">Gallery</h1>

      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((it) => {
            const like = likes[it.id] || { count: 0, liked: false };
            const xHandle = at(it.x);
            const discordName = (it.discord || "").replace(/^@/, "");
            const xUrl = xHandle ? `https://x.com/${xHandle.replace(/^@/, "")}` : "";
            const openPost = it.postUrl && /^https?:\/\/(x\.com|twitter\.com)\//i.test(it.postUrl) ? it.postUrl : "";
            const queryKey = xHandle || discordName || it.title;
            const searchLink = `/gallery?search=${encodeURIComponent(queryKey)}`;
            const isOwner = !!getOwnerTokenFor(it.id);

            return (
              <div key={it.id} className="bg-white/5 rounded-2xl overflow-hidden shadow-lg backdrop-blur-md">
                {/* Gambar + LIKE overlay */}
                <div className="relative">
                  <img src={it.url} alt={it.title} className="w-full aspect-[4/3] object-cover" />
                  <button
                    onClick={() => toggleLike(it)}
                    aria-pressed={like.liked}
                    title={like.liked ? "Unlike" : "Like"}
                    className={`absolute top-2 right-2 select-none inline-flex items-center gap-1 rounded-full px-3 py-1.5 shadow-md backdrop-blur
                      ${like.liked ? "bg-white text-red-600" : "bg-black/50 text-white hover:bg-black/60"}`}
                  >
                    <Heart className={`w-5 h-5 ${like.liked ? "fill-current text-red-600" : "text-red-500"}`} />
                    <span className="text-sm font-medium">{like.count}</span>
                  </button>
                </div>

                <div className="p-4">
                  <div className="font-semibold truncate">{it.title}</div>
                  <div className="text-sm text-white/70 mt-1">
                    {xHandle && (
                      <a href={xUrl} target="_blank" rel="noreferrer" className="underline text-[#4af2ff]">
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
                    <Link href={searchLink} className="btn px-3 py-1 text-xs">Search on Gallery</Link>
                    {openPost && (
                      <a href={openPost} target="_blank" rel="noreferrer" className="btn px-3 py-1 text-xs">
                        Open Art Post
                      </a>
                    )}
                    <button
                      className="btn px-3 py-1 text-xs"
                      onClick={() => navigator.clipboard.writeText(discordName || "")}
                    >
                      Copy Discord
                    </button>
                    {/* tombol like bawah dihapus: sudah di overlay */}
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
