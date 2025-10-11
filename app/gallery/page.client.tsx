"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import Image from "next/image";

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
  if (!text) throw new Error("empty");
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
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

  useEffect(() => {
    const incoming =
      (searchParams.get("search") || searchParams.get("q") || "").trim();
    setQuery(incoming);
  }, [searchParams]);

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

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const curr = sp.get("search") || "";
    if (query !== curr) {
      if (query) sp.set("search", query);
      else sp.delete("search");
      sp.delete("q");
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
      setLikes((prev) => ({
        ...prev,
        [it.id]: { count: j.count ?? 0, liked: !!j.liked },
      }));
    }
  }

  async function onDelete(it: GalleryItem) {
    const token = getOwnerTokenFor(it.id);
    if (!token) return alert("Delete token not found.");
    if (!confirm("Delete this artwork?")) return;

    const j = await fetch(`/api/art/${it.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, metaUrl: it.metaUrl }),
    }).then((r) => r.json());

    if (j?.success)
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    else alert(j?.error || "Delete failed");
  }

  const filtered = useMemo(() => {
    let list = items;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((it) =>
        [it.title, it.x, it.discord].join(" ").toLowerCase().includes(q)
      );
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
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
          {filtered.map((it) => {
            const like = likes[it.id] || { count: 0, liked: false };
            const xHandle = at(it.x);
            const discordName = (it.discord || "").replace(/^@/, "");
            const xUrl = xHandle
              ? `https://x.com/${xHandle.replace(/^@/, "")}`
              : "";
            const openPost =
              it.postUrl &&
              /^https?:\/\/(x\.com|twitter\.com)\//i.test(it.postUrl)
                ? it.postUrl
                : "";
            const queryKey = xHandle || discordName || it.title;
            const isOwner = !!getOwnerTokenFor(it.id);

            return (
              <div
                key={it.id}
                className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.25)] hover:shadow-[0_0_40px_rgba(0,0,0,0.35)] transition-all duration-500"
              >
                {/* Image section */}
                <div className="relative w-full aspect-[4/3] overflow-hidden">
                  <Image
                    src={it.url}
                    alt={it.title}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover opacity-0 animate-fadeIn group-hover:scale-[1.03] transition-transform duration-700"
                  />
                  {/* ❤️ like */}
                  <button
                    onClick={() => toggleLike(it)}
                    aria-pressed={like.liked}
                    title={like.liked ? "Unlike" : "Like"}
                    className={`absolute top-2 right-2 select-none inline-flex items-center gap-1 rounded-full px-3 py-1.5 shadow-md backdrop-blur-md transition-all ${
                      like.liked
                        ? "bg-white text-red-600"
                        : "bg-black/60 text-white hover:bg-black/80"
                    }`}
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        like.liked
                          ? "fill-current text-red-600"
                          : "text-red-500"
                      }`}
                    />
                    <span className="text-sm font-medium">{like.count}</span>
                  </button>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="font-semibold truncate text-white">
                    {it.title}
                  </div>
                  <div className="text-sm text-white/70 mt-1">
                    {xHandle && (
                      <a
                        href={xUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-sky-300 hover:text-sky-200"
                      >
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

                  {/* Buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="btn px-3 py-1 text-xs bg-gradient-to-r from-sky-400/80 to-cyan-300/80 text-black font-semibold"
                      onClick={() => {
                        const target = queryKey || "";
                        setQuery(target);
                        const sp = new URLSearchParams(
                          window.location.search
                        );
                        if (target) sp.set("search", target);
                        else sp.delete("search");
                        sp.delete("q");
                        router.replace(`/gallery?${sp.toString()}`);
                      }}
                    >
                      Search on Gallery
                    </button>

                    {openPost && (
                      <a
                        href={openPost}
                        target="_blank"
                        rel="noreferrer"
                        className="btn px-3 py-1 text-xs bg-white/20 hover:bg-white/30"
                      >
                        Open Art Post
                      </a>
                    )}

                    <button
                      className="btn px-3 py-1 text-xs bg-white/20 hover:bg-white/30"
                      onClick={async () => {
                        const text = discordName || xHandle || "";
                        if (!text) return alert("No Discord or X handle.");
                        const ok = await copyTextForce(text);
                        alert(ok ? "Copied!" : "Copy failed.");
                      }}
                    >
                      Copy Discord
                    </button>
                  </div>

                  {isOwner && (
                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`/edit/${it.id}`}
                        className="btn px-3 py-1 text-xs bg-white/10"
                      >
                        ✏️ Edit
                      </Link>
                      <button
                        onClick={() => onDelete(it)}
                        className="btn px-3 py-1 text-xs bg-red-500/30"
                      >
                        🗑 Delete
                      </button>
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
