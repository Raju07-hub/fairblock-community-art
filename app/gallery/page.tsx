"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Item = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  url: string;
  createdAt: string;
  metaUrl?: string; // dari /api/gallery
};

type TokenRec = {
  metaUrl?: string;
  ownerTokenHash?: string;
  token?: string;
};

const ADMIN_UI = process.env.NEXT_PUBLIC_ADMIN_UI === "true";
const PUB_ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

export default function GalleryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [onlyMine, setOnlyMine] = useState(false);
  const [myTokens, setMyTokens] = useState<Record<string, TokenRec>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  // Admin mode (UI hanya kalau ADMIN_UI = true)
  const [adminMode, setAdminMode] = useState<boolean>(false);

  // ---- load data ------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/gallery", { cache: "no-store" });
      const json = await res.json();
      if (json?.success) setItems(json.items || []);
    })();

    try {
      const raw = localStorage.getItem("fairblock_tokens");
      setMyTokens(raw ? JSON.parse(raw) : {});
    } catch {}

    if (ADMIN_UI) {
      try {
        setAdminMode(localStorage.getItem("fb_admin_mode") === "1");
      } catch {}
    }
  }, []);

  // ---- derived list ---------------------------------------------------------
  const filtered = useMemo(() => {
    let list = [...items];

    if (onlyMine) {
      list = list.filter((it) => Boolean(myTokens[it.id]));
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((it) => {
        const hay =
          (it.title || "") +
          " " +
          (it.x || "") +
          " " +
          (it.discord || "");
        return hay.toLowerCase().includes(q);
      });
    }

    list.sort((a, b) =>
      sort === "new"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return list;
  }, [items, query, sort, onlyMine, myTokens]);

  // ---- helpers --------------------------------------------------------------
  function xHandle(x?: string) {
    if (!x) return "";
    return x.replace(/^@/, "");
  }

  function discordLink(discord?: string): string | undefined {
    if (!discord) return;
    const v = discord.trim();
    if (/^https?:\/\//i.test(v)) return v;           // sudah URL
    if (/^\d{17,20}$/.test(v)) return `https://discord.com/users/${v}`; // user ID
    return undefined; // handle biasa → tidak ada URL langsung
  }

  function chip(onClick: () => void, text: string, title?: string) {
    return (
      <button
        className="btn-ghost text-sm px-3 py-1"
        onClick={onClick}
        title={title || text}
      >
        {text}
      </button>
    );
  }

  // ---- delete ---------------------------------------------------------------
  async function onDelete(id: string, metaUrl?: string, isAdmin = false) {
    const confirmText = isAdmin ? "Delete as ADMIN?" : "Delete this art?";
    if (!confirm(confirmText)) return;
    setDeleting(id);

    try {
      let body: any = {};
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (isAdmin) {
        // Admin override → tidak pakai token, cukup metaUrl + header x-admin-key
        if (!PUB_ADMIN_KEY) {
          throw new Error("Admin key not available on client (NEXT_PUBLIC_ADMIN_KEY missing).");
        }
        if (!metaUrl) {
          throw new Error("Missing token or metaUrl");
        }
        body.metaUrl = metaUrl;
        headers["x-admin-key"] = PUB_ADMIN_KEY;
      } else {
        // Owner: ambil cred lokal
        const rec = myTokens[id];
        if (!rec?.metaUrl) {
          throw new Error("Missing token or metaUrl");
        }
        body = { token: rec.token, metaUrl: rec.metaUrl };
      }

      const res = await fetch(`/api/art/${id}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        // coba tampilkan error dari server bila ada
        throw new Error(data?.error || "Delete failed");
      }

      alert(isAdmin ? "Admin deleted successfully!" : "Deleted successfully!");

      // buang dari list UI
      setItems((prev) => prev.filter((x) => x.id !== id));

      // kalau owner, bersihkan token lokal
      if (!isAdmin) {
        try {
          const copy = { ...myTokens };
          delete copy[id];
          localStorage.setItem("fairblock_tokens", JSON.stringify(copy));
          setMyTokens(copy);
        } catch {}
      }
    } catch (err: any) {
      alert(err?.message || "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  // ---- render ---------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/submit" className="btn">＋ Submit Art</Link>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder="Search title / @x / discord…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="px-4 py-2 rounded-full"
          />

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "new" | "old")}
            className="btn"
          >
            <option value="new">Newest</option>
            <option value="old">Oldest</option>
          </select>

          <label className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              className="accent-white"
            />
            <span className="text-sm">Only My Uploads</span>
          </label>

          {ADMIN_UI && (
            <label className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full cursor-pointer select-none">
              <input
                type="checkbox"
                checked={adminMode}
                onChange={(e) => {
                  const v = e.target.checked;
                  setAdminMode(v);
                  try {
                    localStorage.setItem("fb_admin_mode", v ? "1" : "0");
                  } catch {}
                }}
                className="accent-white"
              />
              <span className="text-sm">Admin Mode</span>
            </label>
          )}

          {query && (
            <button onClick={() => setQuery("")} className="btn-ghost px-4 py-2">
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      <h1 className="text-3xl font-bold text-gradient mb-2">Gallery</h1>
      <p className="text-white/60 mb-6">
        {filtered.length} result{filtered.length !== 1 ? "s" : ""} 
        {ADMIN_UI && adminMode && <span className="ml-2">• <b>Admin Mode ON</b></span>}
        {onlyMine && <span className="ml-2">• showing <b>my uploads</b></span>}
        {query && <span className="ml-2">• for <span className="text-gradient">{query}</span></span>}
      </p>

      {filtered.length === 0 ? (
        <p className="text-white/70">Tidak ada hasil ditemukan.</p>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
          {filtered.map((it) => {
            const mine = Boolean(myTokens[it.id]);
            const dHref = discordLink(it.discord);
            const xUser = xHandle(it.x);

            return (
              <div key={it.id} className="glass rounded-2xl p-3 card-hover flex flex-col">
                {/* Preview gambar - object-contain agar tidak terpotong */}
                <div className="w-full h-56 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
                  {/* pakai bg dan object-contain supaya full tanpa crop */}
                  <img
                    src={it.url}
                    alt={it.title}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="mt-3">
                  <h3 className="font-semibold">{it.title}</h3>

                  <div className="flex flex-wrap gap-2 mt-2">
                    {/* X */}
                    {it.x && (
                      <>
                        {chip(() => setQuery((it.x || "").toLowerCase()), it.x!.startsWith("@") ? it.x! : `@${it.x}` , `Filter by ${it.x}`)}
                        <a
                          href={`https://x.com/${xUser}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost text-sm px-3 py-1 underline"
                          title="Open X profile"
                        >
                          Open X ↗
                        </a>
                      </>
                    )}

                    {/* Discord */}
                    {it.discord && (
                      <>
                        {chip(() => setQuery((it.discord || "").toLowerCase()), it.discord!, `Filter by ${it.discord}`)}
                        {dHref ? (
                          <a
                            href={dHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost text-sm px-3 py-1 underline"
                            title="Open Discord profile"
                          >
                            Copy Discord
                          </a>
                        ) : (
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(it.discord!);
                                alert("Discord handle copied.");
                              } catch {}
                            }}
                            className="btn-ghost text-sm px-3 py-1 underline"
                            title="Copy Discord handle"
                          >
                            Copy Discord
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Owner delete */}
                {mine && (
                  <button
                    onClick={() => onDelete(it.id, it.metaUrl, false)}
                    className="btn-ghost mt-3"
                    disabled={deleting === it.id}
                    title="Delete (owner)"
                  >
                    {deleting === it.id ? "Deleting..." : "🗑 Delete"}
                  </button>
                )}

                {/* Admin delete (kecil & hanya saat Admin Mode ON) */}
                {ADMIN_UI && adminMode && (
                  <button
                    onClick={() => onDelete(it.id, it.metaUrl, true)}
                    className="btn-ghost mt-2 text-xs opacity-70 hover:opacity-100"
                    disabled={deleting === it.id}
                    title="Admin delete"
                  >
                    {deleting === it.id ? "Deleting..." : "🗑 Delete (Admin)"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
