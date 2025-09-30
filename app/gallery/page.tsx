"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// ---- Konfigurasi build-time: tampilkan UI admin bila env di-set ----
const ADMIN_UI = process.env.NEXT_PUBLIC_ADMIN_UI === "true";

// Data item di /api/gallery
type Item = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  url: string;        // URL gambar publik (Blob)
  metaUrl?: string;   // URL metadata JSON pada Blob
  createdAt: string;
};

// Token yang disimpan client saat submit (agar owner bisa hapus)
type TokenMap = Record<
  string, // id
  { token: string; metaUrl?: string }
>;

export default function GalleryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [onlyMine, setOnlyMine] = useState(false);
  const [myTokens, setMyTokens] = useState<TokenMap>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Admin Mode
  const [adminMode, setAdminMode] = useState(false);
  const [adminKey, setAdminKey] = useState("");

  // ------------------------------------------------------------------
  // Bootstrap data
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/gallery", { cache: "no-store" });
      const data = await res.json();
      setItems((data.items || []) as Item[]);
    })();

    try {
      const raw = localStorage.getItem("fairblock_tokens");
      setMyTokens(raw ? JSON.parse(raw) : {});
    } catch {}

    if (ADMIN_UI) {
      try {
        const k = localStorage.getItem("fairblock_admin_key") || "";
        const m = localStorage.getItem("fairblock_admin_mode") === "1";
        setAdminKey(k);
        setAdminMode(m);
      } catch {}
    }
  }, []);

  // ------------------------------------------------------------------
  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...items];
    if (onlyMine) list = list.filter((it) => Boolean(myTokens[it.id]));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          (it.x && it.x.toLowerCase().includes(q)) ||
          (it.discord && it.discord.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) =>
      sort === "new"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return list;
  }, [items, query, sort, onlyMine, myTokens]);

  // ------------------------------------------------------------------
  // Helpers
  function filterByUsername(name: string) {
    const clean = name.trim();
    if (!clean) return;
    setQuery(clean.startsWith("@") ? clean.toLowerCase() : `@${clean.toLowerCase()}`);
  }

  function discordLink(discord?: string): string | undefined {
    if (!discord) return;
    const v = discord.trim();
    if (/^https?:\/\//i.test(v)) return v;               // langsung URL
    if (/^\d{17,20}$/.test(v)) return `https://discord.com/users/${v}`; // user id
    return undefined; // handle biasa: tak ada URL resmi
  }

  async function copyDiscordHandle(h: string) {
    try {
      await navigator.clipboard.writeText(h);
      alert(
        "Discord handle disalin.\n\nCatatan: Link profil langsung hanya bisa kalau kamu menyertakan User ID."
      );
    } catch {
      alert("Gagal menyalin handle.");
    }
  }

  // ------------------------------------------------------------------
  // Delete (owner / admin)
  async function handleDelete(item: Item) {
    const owner = myTokens[item.id];
    const canAdmin = ADMIN_UI && adminMode && adminKey;

    if (!owner && !canAdmin) {
      alert("Kamu tidak punya akses untuk menghapus item ini.");
      return;
    }
    if (!item.metaUrl && !owner?.metaUrl) {
      alert("Missing metaUrl");
      return;
    }
    if (!confirm(`Hapus "${item.title}"?`)) return;

    setLoadingId(item.id);
    try {
      // endpoint unify: /api/art/[id]
      const body: any = {};
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      if (canAdmin) {
        headers["x-admin-key"] = adminKey;
        body.metaUrl = item.metaUrl || owner?.metaUrl; // admin cukup metaUrl
      } else {
        // owner flow
        body.token = owner.token;
        body.metaUrl = owner.metaUrl || item.metaUrl;
      }

      const res = await fetch(`/api/art/${item.id}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Delete failed");
      }

      // sukses → drop dari UI
      setItems((prev) => prev.filter((it) => it.id !== item.id));

      // bersihkan token lokal kalau ada
      if (owner) {
        const copy = { ...myTokens };
        delete copy[item.id];
        localStorage.setItem("fairblock_tokens", JSON.stringify(copy));
        setMyTokens(copy);
      }
    } catch (e: any) {
      alert(e?.message || "Delete gagal");
    } finally {
      setLoadingId(null);
    }
  }

  // simpan admin pref
  function persistAdminPref(nextMode: boolean, nextKey?: string) {
    try {
      localStorage.setItem("fairblock_admin_mode", nextMode ? "1" : "0");
      if (typeof nextKey === "string") {
        localStorage.setItem("fairblock_admin_key", nextKey);
      }
    } catch {}
  }

  // ------------------------------------------------------------------
  // Render
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

          {query && (
            <button onClick={() => setQuery("")} className="btn-ghost px-4 py-2">
              ✕ Clear
            </button>
          )}

          {/* Admin small panel */}
          {ADMIN_UI && (
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={adminMode}
                  onChange={(e) => {
                    setAdminMode(e.target.checked);
                    persistAdminPref(e.target.checked);
                  }}
                />
                <span className="text-sm">Admin Mode</span>
              </label>

              <input
                type="password"
                placeholder="Admin Key"
                value={adminKey}
                onChange={(e) => {
                  setAdminKey(e.target.value);
                  persistAdminPref(adminMode, e.target.value);
                }}
                className="px-3 py-1 rounded-full bg-white/10 text-sm"
                style={{ width: 160 }}
              />
            </div>
          )}
        </div>
      </div>

      <h1 className="text-3xl font-bold text-gradient mb-2">Gallery</h1>
      <p className="text-white/60 mb-6">
        {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        {query && (
          <span className="ml-2">
            for <span className="text-gradient">{query}</span>
          </span>
        )}
        {onlyMine && <span className="ml-2">• showing <b>my uploads</b></span>}
        {ADMIN_UI && adminMode && <span className="ml-2">• <b>Admin Mode</b> ON</span>}
      </p>

      {filtered.length === 0 ? (
        <p className="text-white/70">No results found.</p>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
          {filtered.map((it) => {
            const ownerToken = myTokens[it.id];
            const canOwnerDelete = Boolean(ownerToken);
            const canAdminDelete = ADMIN_UI && adminMode && !!adminKey;

            const xHandle = it.x ? it.x.replace(/^@/, "") : "";
            const dHref = discordLink(it.discord);

            return (
              <div key={it.id} className="glass rounded-2xl p-3 card-hover flex flex-col">
                {/* Gambar full tanpa crop */}
                <div className="w-full aspect-[1/1] rounded-xl bg-white/5 overflow-hidden">
                  <img
                    src={it.url}
                    alt={it.title}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>

                <div className="mt-3">
                  <h3 className="font-semibold">{it.title}</h3>

                  {/* chips / tindakan */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {/* X: chip filter + link */}
                    {it.x && (
                      <>
                        <button
                          className="btn-ghost text-sm px-3 py-1"
                          onClick={() => filterByUsername(it.x!)}
                          title={`Filter by ${it.x}`}
                        >
                          {it.x.startsWith("@") ? it.x : `@${it.x}`}
                        </button>
                        <a
                          href={`https://x.com/${xHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost text-sm px-3 py-1 underline"
                          title="Open X profile"
                        >
                          Open X ↗
                        </a>
                      </>
                    )}

                    {/* Discord: open (ID/URL) atau copy handle */}
                    {it.discord && (
                      <>
                        <button
                          className="btn-ghost text-sm px-3 py-1"
                          onClick={() => setQuery(it.discord!.toLowerCase())}
                          title={`Filter by ${it.discord}`}
                        >
                          {it.discord}
                        </button>

                        {dHref ? (
                          <a
                            href={dHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost text-sm px-3 py-1 underline"
                            title="Open Discord profile"
                          >
                            Open Discord ↗
                          </a>
                        ) : (
                          <button
                            onClick={() => copyDiscordHandle(it.discord!)}
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

                {/* Delete buttons */}
                {(canOwnerDelete || canAdminDelete) && (
                  <div className="mt-3 flex gap-2">
                    {canOwnerDelete && (
                      <button
                        onClick={() => handleDelete(it)}
                        className="btn-ghost text-red-400 hover:text-red-300"
                        disabled={loadingId === it.id}
                        title="Hapus karya ini (hanya uploader)"
                      >
                        {loadingId === it.id ? "Deleting..." : "🗑 Delete"}
                      </button>
                    )}

                    {canAdminDelete && (
                      <button
                        onClick={() => handleDelete(it)}
                        className="btn-ghost text-red-400 hover:text-red-300"
                        disabled={loadingId === it.id}
                        title="Admin override delete"
                      >
                        {loadingId === it.id ? "Deleting..." : "🗑 Delete (Admin)"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
