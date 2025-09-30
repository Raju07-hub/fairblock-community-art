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
  // untuk model baru (Blob) daftar /api/gallery sudah mengembalikan ini
  metaUrl?: string;
};

type TokenRec = {
  /** model baru */
  metaUrl?: string;
  /** hash dari server (informasi saja) */
  ownerTokenHash?: string;
  /** raw token (legacy atau kalau server mengembalikan saat upload) */
  token?: string;
};

// env publik untuk memunculkan switch admin
const ADMIN_SWITCH_ON = process.env.NEXT_PUBLIC_ADMIN_UI === "true";

export default function GalleryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [onlyMine, setOnlyMine] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  const [tokens, setTokens] = useState<Record<string, TokenRec>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [adminLoadingId, setAdminLoadingId] = useState<string | null>(null);

  // ---------- load ----------
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/gallery", { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? (data.items as Item[]) : []);
    })();
    try {
      const raw = localStorage.getItem("fairblock_tokens");
      setTokens(raw ? JSON.parse(raw) : {});
    } catch {}
  }, []);

  // ---------- filter/sort ----------
  const filtered = useMemo(() => {
    let list = [...items];
    if (onlyMine) list = list.filter((it) => Boolean(tokens[it.id]));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          (it.x && it.x.toLowerCase().includes(q)) ||
          (it.discord && it.discord.toLowerCase().includes(q)),
      );
    }
    list.sort((a, b) =>
      sort === "new"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return list;
  }, [items, query, sort, onlyMine, tokens]);

  // ---------- helpers ----------
  function discordLink(discord?: string): string | undefined {
    if (!discord) return;
    const v = discord.trim();
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\d{17,20}$/.test(v)) return `https://discord.com/users/${v}`;
    return undefined;
  }

  async function copyDiscordHandle(h: string) {
    try {
      await navigator.clipboard.writeText(h);
      alert(
        "Discord handle disalin.\n\nCatatan: Link langsung ke profil Discord hanya bisa jika kamu menyertakan User ID (Settings → Advanced → Developer Mode → Copy ID).",
      );
    } catch {
      alert("Gagal menyalin handle.");
    }
  }

  function filterByUsername(name: string) {
    const clean = name.trim();
    if (!clean) return;
    setQuery(clean.startsWith("@") ? clean.toLowerCase() : `@${clean.toLowerCase()}`);
  }

  // ---------- DELETE (Owner) ----------
  async function handleDeleteOwner(item: Item) {
    const rec = tokens[item.id];

    // Kalau tidak punya kredensial sama sekali → beri tahu user.
    if (!rec || (!rec.token && !rec.metaUrl)) {
      alert(
        "Kredensial hapus untuk item ini tidak ditemukan di perangkat ini.\n\n" +
          "Silakan hapus dari perangkat yang digunakan saat upload, atau minta admin untuk menghapus.",
      );
      return;
    }

    if (!confirm(`Hapus "${item.title}" ?`)) return;

    setLoadingId(item.id);
    try {
      // Prioritas: model baru (Blob) → perlu token + metaUrl
      if (rec.metaUrl && rec.token) {
        const res = await fetch(`/api/art/${item.id}`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: rec.token, metaUrl: rec.metaUrl }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Delete failed");
        }
      } else if (rec.token) {
        // Legacy fallback (JSON lokal)
        const res = await fetch(`/api/gallery/${item.id}`, {
          method: "DELETE",
          headers: { "x-delete-token": rec.token },
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Delete failed");
        }
      } else {
        throw new Error("Kredensial tidak lengkap (token/metaUrl hilang).");
      }

      // Bersihkan UI & localStorage
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      const copy = { ...tokens };
      delete copy[item.id];
      localStorage.setItem("fairblock_tokens", JSON.stringify(copy));
      setTokens(copy);
    } catch (e: any) {
      alert(e?.message || "Delete gagal");
    } finally {
      setLoadingId(null);
    }
  }

  // ---------- DELETE (Admin) ----------
  async function handleDeleteAdmin(item: Item) {
    if (!adminMode) return;
    if (!confirm(`ADMIN: Hapus "${item.title}" ?`)) return;

    // admin key di localStorage (diset lewat ui toggle kecil)
    const adminKey = localStorage.getItem("fb_admin_key") || "";
    if (!adminKey) {
      alert("Admin key belum di-set. Klik titik-titik di switch Admin Mode untuk mengisinya.");
      return;
    }

    setAdminLoadingId(item.id);
    try {
      if (item.metaUrl) {
        // Model baru (Blob): kirim metaUrl saja + header admin
        const res = await fetch(`/api/art/${item.id}`, {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({ metaUrl: item.metaUrl }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Admin delete failed");
        }
      } else {
        // Legacy fallback (JSON lokal) – route ini juga sudah menerima x-admin-key
        const res = await fetch(`/api/gallery/${item.id}`, {
          method: "DELETE",
          headers: { "x-admin-key": adminKey },
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Admin delete failed");
        }
      }

      setItems((prev) => prev.filter((x) => x.id !== item.id));
      // token uploader (kalau ada) tidak wajib dibersihkan di admin mode
    } catch (e: any) {
      alert(e?.message || "Admin delete gagal");
    } finally {
      setAdminLoadingId(null);
    }
  }

  // ---------- UI ----------
  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-3">
          <Link href="/" className="btn">
            ⬅ Back Home
          </Link>
          <Link href="/submit" className="btn">
            ＋ Submit Art
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder="Search title / @x / disco…"
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

          {ADMIN_SWITCH_ON && (
            <label
              className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full cursor-pointer select-none"
              title="Hold click untuk set Admin Key"
              onContextMenu={(e) => {
                e.preventDefault();
                const v = prompt("Masukkan ADMIN_KEY:");
                if (v) localStorage.setItem("fb_admin_key", v);
              }}
              onDoubleClick={() => {
                const v = prompt("Masukkan ADMIN_KEY:");
                if (v) localStorage.setItem("fb_admin_key", v);
              }}
            >
              <input
                type="checkbox"
                checked={adminMode}
                onChange={(e) => setAdminMode(e.target.checked)}
                className="accent-white"
              />
              <span className="text-sm">Admin Mode</span>
              <button
                type="button"
                className="ml-2 text-xs opacity-70 hover:opacity-100 underline"
                onClick={() => {
                  const current = localStorage.getItem("fb_admin_key") || "";
                  const v = prompt("Set / Update ADMIN_KEY:", current);
                  if (v !== null) {
                    if (v) localStorage.setItem("fb_admin_key", v);
                    else localStorage.removeItem("fb_admin_key");
                  }
                }}
                title="Set ADMIN_KEY"
              >
                ●●●
              </button>
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
        {onlyMine && <span className="ml-2">• showing <b>my uploads</b></span>}
        {ADMIN_SWITCH_ON && adminMode && <span className="ml-2">• <b>Admin Mode ON</b></span>}
      </p>

      {filtered.length === 0 ? (
        <p className="text-white/70">Tidak ada hasil ditemukan.</p>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
          {filtered.map((it) => {
            const canDeleteOwner = Boolean(tokens[it.id]);
            const xHandle = it.x ? it.x.replace(/^@/, "") : "";
            const dHref = discordLink(it.discord);

            return (
              <div key={it.id} className="glass rounded-2xl p-3 card-hover flex flex-col">
                <img
                  src={it.url}
                  alt={it.title}
                  className="w-full h-56 object-cover rounded-xl"
                />

                <div className="mt-3">
                  <h3 className="font-semibold">{it.title}</h3>

                  <div className="flex flex-wrap gap-2 mt-2">
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

                <div className="mt-3 flex gap-2">
                  {canDeleteOwner && (
                    <button
                      onClick={() => handleDeleteOwner(it)}
                      className="btn-ghost"
                      disabled={loadingId === it.id}
                      title="Hapus karya ini (hanya uploader)"
                    >
                      {loadingId === it.id ? "Deleting…" : "🗑 Delete"}
                    </button>
                  )}

                  {ADMIN_SWITCH_ON && adminMode && (
                    <button
                      onClick={() => handleDeleteAdmin(it)}
                      className="btn-ghost text-red-400 hover:text-red-300 text-xs px-3"
                      disabled={adminLoadingId === it.id}
                      title="Hapus (Admin)"
                    >
                      {adminLoadingId === it.id ? "Deleting…" : "🗑 Delete (Admin)"}
                    </button>
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
