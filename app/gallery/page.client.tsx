// app/gallery/page.client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, X, ChevronLeft, ChevronRight } from "lucide-react";

type GalleryItem = {
  id: string;
  title: string;
  url: string;
  x?: string;
  discord?: string;
  createdAt: string;
  metaUrl: string;
  postUrl?: string;
  ownerTokenHash?: string; // ← dipakai untuk rebind/claim
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

/** Hash helper (hex, sama seperti server sha256) */
async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Gabung semua kemungkinan storage lama jadi 1 map {idOrKey: token} */
function readAllLegacyTokenMaps(): Record<string, string> {
  const keys = ["fairblock:tokens", "fb:tokens", "gallery:tokens", "fairblock:deleteTokens"];
  const out: Record<string, string> = {};
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") continue;

      if (Array.isArray(obj)) {
        for (const it of obj) {
          if (Array.isArray(it) && it[0] && it[1]) out[String(it[0])] = String(it[1]);
          else if (it && typeof it === "object" && it.id && it.token) out[String(it.id)] = String(it.token);
        }
      } else {
        for (const [id, t] of Object.entries(obj)) out[String(id)] = String(t as any);
      }
    } catch {}
  }
  return out;
}

/** Simpan map final owner tokens hanya ke key baru "fairblock:tokens" */
function writeOwnerMap(map: Record<string, string>) {
  try {
    localStorage.setItem("fairblock:tokens", JSON.stringify(map));
  } catch {}
}

/** === Tambahan helper ringan untuk auto-claim === */
function readOwnerMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("fairblock:tokens") || "{}");
  } catch {
    return {};
  }
}
function bindOwnerToken(id: string, token: string) {
  const cur = readOwnerMap();
  cur[id] = token;
  writeOwnerMap(cur);
}

/** Auto-rebind: cocokan token lama (by hash) ke item yang tampil */
async function autoRebindLegacyTokens(items: GalleryItem[]) {
  if (typeof window === "undefined" || !items?.length) return;

  // ambil map saat ini & semua kandidat token lama
  let current: Record<string, string> = {};
  try {
    current = JSON.parse(localStorage.getItem("fairblock:tokens") || "{}");
  } catch {}

  const candidates = readAllLegacyTokenMaps();
  const candidateList = Object.values(candidates).filter(Boolean);
  if (!candidateList.length) return;

  // Buat lookup hash => token (biar hash sekali per token)
  const hashToToken: Record<string, string> = {};
  await Promise.all(
    candidateList.map(async (tok) => {
      const h = await sha256Hex(tok);
      hashToToken[h] = tok;
    })
  );

  // Cocokkan per item (yang belum punya token)
  let changed = false;
  for (const it of items) {
    if (!it.ownerTokenHash || current[it.id]) continue;
    const token = hashToToken[it.ownerTokenHash];
    if (token) {
      current[it.id] = token;
      changed = true;
    }
  }

  if (changed) writeOwnerMap(current);
}

/**
 * Auto-first-claim utk item lama:
 * - item belum punya ownerTokenHash
 * - browser punya token lama untuk id tsb (di legacy storage)
 * → kirim PUT /api/art/[id] untuk menulis ownerTokenHash
 * → simpan token ke storage modern agar isOwner() langsung true
 */
async function autoFirstClaimMissingOwnerHash(items: GalleryItem[]) {
  if (typeof window === "undefined" || !items?.length) return;

  const legacy = readAllLegacyTokenMaps();
  const targets = items.filter((it) => !it.ownerTokenHash && legacy[it.id] && it.metaUrl);

  if (!targets.length) return;

  for (const it of targets) {
    const token = legacy[it.id];
    if (!token) continue;

    try {
      const res = await fetch(`/api/art/${encodeURIComponent(it.id)}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-owner-token": token,
        },
        body: JSON.stringify({ metaUrl: it.metaUrl, patch: {} }),
      });

      if (res.ok) {
        const j = await res.json().catch(() => null);
        const newHash = j?.meta?.ownerTokenHash;
        if (newHash) {
          bindOwnerToken(it.id, token);
        }
      }
    } catch {
      // diamkan agar tidak mengganggu UX
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

  // lightbox
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);
  const [enterPhase, setEnterPhase] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const ts = Date.now();
      const j = await fetch(`/api/gallery?ts=${ts}`, { cache: "no-store" }).then((r) => r.json());
      const list: GalleryItem[] = j?.items || [];
      setItems(list);

      // 🔁 rebind token lama -> id baru
      await autoRebindLegacyTokens(list);

      // 🆕 auto-claim untuk item lama yang belum punya ownerTokenHash
      await autoFirstClaimMissingOwnerHash(list);

      // re-render ringan agar tombol Edit/Delete langsung muncul
      setItems((prev) => prev.slice());

      if (list.length) {
        const ids = list.map((i) => i.id).join(",");
        const liked = await fetch(`/api/likes?ids=${ids}&ts=${ts}`, { cache: "no-store" }).then((r) => r.json());
        setLikes(liked?.data || {});
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

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

  const filtered = useMemo(() => {
    let list = items;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((it) => [it.title, it.x, it.discord].join(" ").toLowerCase().includes(q));
    }
    if (onlyMine) list = list.filter((it) => !!getOwnerTokenFor(it.id));
    list = list
      .slice()
      .sort((a, b) =>
        sort === "newest"
          ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    return list;
  }, [items, query, onlyMine, sort]);

  // --- Lightbox helpers
  function openAt(i: number) {
    setAnimDir(null);
    setSelectedIndex(i);
  }
  function closeLightbox() {
    setSelectedIndex(null);
  }
  function prevImage() {
    if (selectedIndex === null) return;
    setAnimDir("left");
    setSelectedIndex((i) => (i! > 0 ? i! - 1 : filtered.length - 1));
  }
  function nextImage() {
    if (selectedIndex === null) return;
    setAnimDir("right");
    setSelectedIndex((i) => (i! < filtered.length - 1 ? i! + 1 : 0));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowRight") nextImage();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (selectedIndex === null) return;
    setEnterPhase(false);
    const t = setTimeout(() => setEnterPhase(true), 20);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10 relative">
      {/* === Action bar === */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-3">
          <Link href="/" className="btn">
            ⬅ Back Home
          </Link>
          <Link href="/submit" className="btn">
            ＋ Submit Art
          </Link>
          <Link href="/leaderboard" className="btn">
            🏆 Leaderboard
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title / @x / discord..."
            className="px-4 py-2 rounded-full bg-white/10 outline-none w-56 text-white placeholder-white/60"
          />

          <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "oldest")} className="btn px-4 py-2 text-sm">
            <option value="newest">Newest</option>
            <option value="oldest">Older</option>
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
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
          {filtered.map((it, idx) => {
            const like = likes[it.id] || { count: 0, liked: false };
            const xHandle = at(it.x);
            const discordName = (it.discord || "").replace(/^@/, "");
            const xUrl = xHandle ? `https://x.com/${xHandle.replace(/^@/, "")}` : "";
            const openPost = it.postUrl && /^https?:\/\/(x\.com|twitter\.com)\//i.test(it.postUrl) ? it.postUrl : "";
            const isOwner = !!getOwnerTokenFor(it.id);

            return (
              <div key={it.id} className="glass rounded-2xl overflow-hidden card-hover transition transform hover:scale-[1.02]">
                <div className="relative cursor-pointer" onClick={() => openAt(idx)}>
                  <img src={it.url} alt={it.title} className="w-full aspect-[4/3] object-contain bg-black/20" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(it);
                    }}
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
                    <button className="btn px-3 py-1 text-xs" onClick={() => setQuery(xHandle || discordName || "")}>
                      Search on Gallery
                    </button>
                    {openPost && (
                      <a href={openPost} target="_blank" rel="noreferrer" className="btn px-3 py-1 text-xs">
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
                      <Link href={`/edit/${it.id}`} className="btn px-3 py-1 text-xs bg-white/10">
                        ✏️ Edit
                      </Link>
                      <button
                        onClick={async () => {
                          const token = getOwnerTokenFor(it.id);
                          if (!token) return alert("Delete token not found. Use the same browser you used to submit.");
                          if (!confirm("Delete this artwork?")) return;

                          try {
                            // Coba endpoint gaya baru: /api/art/:id (DELETE)
                            let res = await fetch(`/api/art/${it.id}`, {
                              method: "DELETE",
                              headers: {
                                "content-type": "application/json",
                                "x-owner-token": token,
                              },
                              body: JSON.stringify({ metaUrl: it.metaUrl }),
                            });

                            // Fallback ke endpoint lama: /api/delete (POST)
                            if (!res.ok) {
                              res = await fetch(`/api/delete?id=${encodeURIComponent(it.id)}`, {
                                method: "POST",
                                headers: {
                                  "content-type": "application/json",
                                  "x-owner-token": token,
                                },
                                body: JSON.stringify({ id: it.id, metaUrl: it.metaUrl }),
                              });
                            }

                            const j = await res.json().catch(() => null);
                            if (res.ok && j?.success) {
                              setItems((prev) => prev.filter((x) => x.id !== it.id));
                            } else {
                              alert(j?.error || `Delete failed (${res.status})`);
                            }
                          } catch (e: any) {
                            alert(e?.message || "Delete error");
                          }
                        }}
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

      {/* === Lightbox === */}
      {selectedIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={closeLightbox}>
          <div className="relative max-w-4xl w-[80%] h-[80vh] flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div
              className={[
                "relative flex-1 w-full flex items-center justify-center transition-all duration-300",
                enterPhase
                  ? "opacity-100 translate-x-0"
                  : animDir === "right"
                  ? "opacity-0 translate-x-6"
                  : animDir === "left"
                  ? "opacity-0 -translate-x-6"
                  : "opacity-0 translate-y-2",
              ].join(" ")}
            >
              <img
                src={filtered[selectedIndex].url}
                alt={filtered[selectedIndex].title}
                className="max-h-[70vh] w-auto rounded-xl shadow-2xl object-contain"
              />

              <button className="absolute top-3 right-3 bg-white/20 hover:bg-white/30 rounded-full p-2" onClick={closeLightbox} aria-label="Close preview">
                <X className="w-6 h-6 text-white" />
              </button>

              <button className="absolute left-3 text-white bg-black/40 hover:bg-black/60 p-3 rounded-full" onClick={prevImage} aria-label="Previous artwork">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button className="absolute right-3 text-white bg-black/40 hover:bg-black/60 p-3 rounded-full" onClick={nextImage} aria-label="Next artwork">
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {(() => {
              const sel = filtered[selectedIndex];
              const xHandle = sel.x ? (sel.x.startsWith("@") ? sel.x : `@${sel.x}`) : "";
              const discordName = (sel.discord || "").replace(/^@/, "");
              const xUrl = xHandle ? `https://x.com/${xHandle.replace(/^@/, "")}` : "";
              const openPost = sel.postUrl && /^https?:\/\/(x\.com|twitter\.com)\//i.test(sel.postUrl) ? sel.postUrl : "";

              return (
                <div
                  className={[
                    "w-full max-w-3xl mt-4 glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 transition-all duration-300",
                    enterPhase ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                  ].join(" ")}
                >
                  <div>
                    <div className="font-semibold">{sel.title}</div>
                    <div className="text-sm text-white/70 mt-1">
                      {xHandle && (
                        <a href={xUrl} target="_blank" rel="noreferrer" className="underline text-sky-300 hover:text-sky-200">
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
                  </div>
                  {openPost && (
                    <a href={openPost} target="_blank" rel="noreferrer" className="btn px-4 py-1 text-sm">
                      Open Art Post ↗
                    </a>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
