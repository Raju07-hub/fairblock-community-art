// app/gallery/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TokenRec = {
  metaUrl?: string;        // lokasi metadata (model baru)
  ownerTokenHash?: string; // hanya informasi (tidak dipakai delete di client)
  token?: string;          // deleteToken lama (legacy)
};

type Item = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  url: string;
  createdAt: string;
  metaUrl?: string; // penting untuk delete owner/admin model baru
};

const ADMIN_UI = process.env.NEXT_PUBLIC_ADMIN_UI === "true";

export default function GalleryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [onlyMine, setOnlyMine] = useState(false);
  const [tokens, setTokens] = useState<Record<string, TokenRec>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Admin UI
  const [adminMode, setAdminMode] = useState<boolean>(false);
  const [adminKey, setAdminKey] = useState<string>("");

  // Load data
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/gallery", { cache: "no-store" });
      const data = await res.json();
      setItems((data.items || []) as Item[]);
    })();
    try {
      setTokens(JSON.parse(localStorage.getItem("fairblock_tokens") || "{}"));
    } catch {}
    try {
      setAdminMode(localStorage.getItem("fb_admin_on") === "1");
      setAdminKey(localStorage.getItem("fb_admin_key") || "");
    } catch {}
  }, []);

  // Derived list
  const filtered = useMemo(() => {
    let list = [...items];

    if (onlyMine) {
      list = list.filter((it) => !!tokens[it.id]);
    }

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
  }, [items, query, sort, onlyMine, tokens]);

  // Helpers
  function discordLink(discord?: string): string | undefined {
    if (!discord) return;
    const v = discord.trim();
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\d{17,20}$/.test(v)) return `https://discord.com/users/${v}`;
    return undefined; // username/handle tak punya URL resmi
  }

  async function copyDiscordHandle(h: string) {
    try {
      await navigator.clipboard.writeText(h);
      alert(
        "Discord handle disalin.\n\nTips: agar bisa buka profil langsung, simpan User ID (Settings → Advanced → Developer Mode → Copy ID)."
      );
    } catch {
      alert("Gagal menyalin handle.");
    }
  }

  function filterByX(handle: string) {
    const clean = handle.replace(/^@/, "");
    setQuery("@" + clean.toLowerCase());
  }

  // Delete — OWNER (model baru + fallback legacy)
  async function handleDeleteOwner(it: Item) {
    const rec = tokens[it.id];
    if (!rec) return alert("Kamu tidak punya akses untuk menghapus item ini.");
    if (!confirm("Hapus karya ini?")) return;

    setLoadingId(it.id);
    try {
      // Model baru: ada metaUrl + token (atau token tersimpan)
      if (it.metaUrl) {
        const token = rec.token;
        if (!token) {
          // kalau token tak ada (kasus sangat jarang), minta user
          const t = prompt("Masukkan token hapus (dari saat upload):") || "";
          if (!t) throw new Error("Token diperlukan untuk hapus oleh owner.");
          rec.token = t;
          localStorage.setItem(
            "fairblock_tokens",
            JSON.stringify({ ...tokens, [it.id]: rec })
          );
          setTokens((prev) => ({ ...prev, [it.id]: rec }));
        }

        const res = await fetch(`/api/art/${it.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: rec.token, metaUrl: it.metaUrl }),
        });
        const data = await res.json();
        if (!data?.success) throw new Error(data?.error || "Gagal hapus");
      } else {
        // Legacy: tak punya metaUrl → hapus via route lama
        const t = rec.token;
        if (!t) throw new Error("Item lama: butuh deleteToken untuk hapus.");
        const res = await fetch(`/api/gallery/${it.id}`, {
          method: "DELETE",
          headers: { "x-delete-token": t },
        });
        const data = await res.json();
        if (!data?.success) throw new Error(data?.error || "Gagal hapus");
      }

      // sukses → update UI & storage
      setItems((prev) => prev.filter((x) => x.id !== it.id));
      const copy = { ...tokens };
      delete copy[it.id];
      localStorage.setItem("fairblock_tokens", JSON.stringify(copy));
      setTokens(copy);
    } catch (e: any) {
      alert(e?.message || "Delete gagal");
    } finally {
      setLoadingId(null);
    }
  }

  // Delete — ADMIN (override)
  async function handleDeleteAdmin(it: Item) {
    if (!adminMode) return;
    if (!adminKey) {
      const k = prompt("Masukkan ADMIN_KEY:") || "";
      if (!k) return;
      setAdminKey(k);
      localStorage.setItem("fb_admin_key", k);
    }
    if (!it.metaUrl) return alert("Missing token or metaUrl"); // konsisten dengan pesanmu
    if (!confirm("Admin: hapus karya ini?")) return;

    setLoadingId(it.id);
    try {
      const res = await fetch(`/api/art/${it.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": localStorage.getItem("fb_admin_key") || "",
        },
        body: JSON.stringify({ metaUrl: it.metaUrl }), // <- WAJIB!
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Admin delete gagal");
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } catch (e: any) {
      alert(e?.message || "Admin delete gagal");
    } finally {
      setLoadingId(null);
    }
  }

  // UI
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
                  const on = e.target.checked;
                  setAdminMode(on);
                  localStorage.setItem("fb_admin_on", on ? "1" : "0");
                  if (on && !localStorage.getItem("fb_admin_key")) {
                    const k = prompt("Masukkan ADMIN_KEY:") || "";
                    if (k) {
                      localStorage.setItem("fb_admin_key", k);
                      setAdminKey(k);
                    }
                  }
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
        {query && (
          <span className="ml-2">
            for <span className="text-gradient">{query}</span>
          </span>
        )}
        {onlyMine && <span className="ml-2">• showing <b>my uploads</b></span>}
        {ADMIN_UI && adminMode && <span className="ml-2">• <b>Admin Mode ON</b></span>}
      </p>

      {filtered.length === 0 ? (
        <p className="text-white/70">Tidak ada hasil ditemukan.</p>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {filtered.map((it) => {
            const rec = tokens[it.id];
            const canOwnerDelete = !!rec;
            const xHandle = it.x ? it.x.replace(/^@/, "") : "";
            const dHref = discordLink(it.discord);

            return (
              <div key={it.id} className="glass rounded-2xl p-3 card-hover flex flex-col">
                <div className="w-full h-56 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden">
                  <img
                    src={it.url}
                    alt={it.title}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="mt-3">
                  <h3 className="font-semibold">{it.title}</h3>

                  <div className="flex flex-wrap gap-2 mt-2">
                    {it.x && (
                      <>
                        <button
                          className="btn-ghost text-sm px-3 py-1"
                          onClick={() => filterByX(it.x!)}
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

                {/* Owner delete */}
                {canOwnerDelete && (
                  <button
                    onClick={() => handleDeleteOwner(it)}
                    className="btn-ghost mt-3 text-red-400 hover:text-red-300"
                    disabled={loadingId === it.id}
                    title="Hapus karya ini (hanya uploader)"
                  >
                    {loadingId === it.id ? "Deleting..." : "🗑 Delete"}
                  </button>
                )}

                {/* Admin delete (kecil & tak mencolok) */}
                {ADMIN_UI && adminMode && (
                  <button
                    onClick={() => handleDeleteAdmin(it)}
                    className="btn-ghost mt-2 text-xs text-red-300/80 hover:text-red-200/90 self-start"
                    disabled={loadingId === it.id}
                    title="Admin delete"
                  >
                    {loadingId === it.id ? "Deleting…" : "🗑 Delete (Admin)"}
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
