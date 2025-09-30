"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Item = {
  id: string;
  title: string;
  x?: string;        // "@kanjuro" atau "kanjuro"
  discord?: string;  // user id (digit), URL, atau handle (name#1234 / nama)
  url: string;
  createdAt: string;
};

// Penyimpanan lokal: versi baru dan versi lama (kompatibilitas)
type TokenEntry = { token: string; metaUrl: string };
type TokenMapNew = Record<string, TokenEntry>;
type TokenMapAny = Record<string, TokenEntry | string>;

export default function GalleryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [onlyMine, setOnlyMine] = useState(false);
  const [myTokens, setMyTokens] = useState<TokenMapAny>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

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
  }, []);

  const filtered = useMemo(() => {
    let list = [...items];

    if (onlyMine) {
      list = list.filter((it) => Boolean(myTokens[it.id]));
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
  }, [items, query, sort, onlyMine, myTokens]);

  async function handleDelete(id: string) {
    const entry = myTokens[id];

    if (!entry) {
      alert("You don't have access to delete this item.");
      return;
    }

    const isLegacy = typeof entry === "string";
    if (!confirm("Delete this artwork?")) return;

    setLoadingId(id);
    try {
      if (isLegacy) {
        // ===== Fallback skema lama (hanya token, tanpa metaUrl) =====
        const token = entry as string;
        const res = await fetch(`/api/gallery/${id}`, {
          method: "DELETE",
          headers: { "x-delete-token": token },
        });
        const data = await res.json();
        if (!data?.success) throw new Error(data?.error || "Delete failed");
      } else {
        // ===== Skema baru berbasis Blob metadata =====
        const { token, metaUrl } = entry as TokenEntry;
        if (!metaUrl) {
          alert("Missing metaUrl");
          return;
        }
        const res = await fetch(`/api/art/${id}`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ownerTokenHash: token,
            metaUrl,
          }),
        });
        const data = await res.json();
        if (!data?.success && !data?.ok) {
          throw new Error(data?.error || "Delete failed");
        }
      }

      // Hapus dari UI + localStorage
      setItems((prev) => prev.filter((it) => it.id !== id));
      const next: TokenMapAny = { ...myTokens };
      delete next[id];
      localStorage.setItem("fairblock_tokens", JSON.stringify(next));
      setMyTokens(next);
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setLoadingId(null);
    }
  }

  function filterByUsername(name: string) {
    const clean = name.trim();
    if (!clean) return;
    setQuery(clean.startsWith("@") ? clean.toLowerCase() : `@${clean.toLowerCase()}`);
  }

  // ===== Helper link Discord =====
  function discordLink(discord?: string): string | undefined {
    if (!discord) return;
    const v = discord.trim();

    // Jika URL langsung
    if (/^https?:\/\//i.test(v)) return v;

    // Jika ID pengguna (17-20 digit)
    if (/^\d{17,20}$/.test(v)) return `https://discord.com/users/${v}`;

    // Selain itu (handle/username), tidak ada URL resmi — return undefined
    return undefined;
  }

  async function copyDiscordHandle(h: string) {
    try {
      await navigator.clipboard.writeText(h);
      alert(
        "Discord handle copied.\n\nNote: A direct profile link only works if you provide your Discord User ID (Settings → Advanced → Developer Mode → Copy ID)."
      );
    } catch {
      alert("Failed to copy handle.");
    }
  }

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

          {/* Select ikut gradient dengan class .btn */}
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
      </p>

      {filtered.length === 0 ? (
        <p className="text-white/70">No results found.</p>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
          {filtered.map((it) => {
            const entry = myTokens[it.id];
            const canDelete = Boolean(entry);
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

                  {/* chips / tindakan */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {/* X: chip filter + link profil */}
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

                    {/* Discord: jika bisa link → buka; jika tidak → copy handle */}
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

                {canDelete && (
                  <button
                    onClick={() => handleDelete(it.id)}
                    className="btn-ghost mt-3 text-red-400 hover:text-red-300"
                    disabled={loadingId === it.id}
                    title="Delete this artwork (uploader only)"
                  >
                    {loadingId === it.id ? "Deleting..." : "🗑 Delete"}
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
