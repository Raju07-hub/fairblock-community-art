"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Item = {
  id: string;
  title: string;
  x?: string;        // "@kanjuro" or "kanjuro"
  discord?: string;  // user id (digits), URL, or handle
  url: string;
  createdAt: string;
};

type TokenRec = {
  metaUrl?: string;        // required for new Blob-delete flow
  ownerTokenHash?: string; // optional, returned by server
  token?: string;          // legacy deleteToken (fallback)
};

export default function GalleryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [onlyMine, setOnlyMine] = useState(false);
  const [myTokens, setMyTokens] = useState<Record<string, TokenRec>>({});
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

  async function handleDelete(id: string) {
    const rec = myTokens[id];
    if (!rec) return alert("You don't have permission to delete this item (no local token).");

    // New flow requires metaUrl; warn if missing
    if (!rec.metaUrl) {
      alert(
        "Missing metaUrl for this item. If this artwork was uploaded before the Blob migration or from a different browser, you may need to re-upload from this browser."
      );
      return;
    }

    if (!confirm("Delete this artwork?")) return;

    setLoadingId(id);
    try {
      const res = await fetch(`/api/art/${id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metaUrl: rec.metaUrl,
          ownerTokenHash: rec.ownerTokenHash,
          token: rec.token, // optional fallback
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || "Delete failed");

      setItems((prev) => prev.filter((it) => it.id !== id));
      const copy = { ...myTokens };
      delete copy[id];
      localStorage.setItem("fairblock_tokens", JSON.stringify(copy));
      setMyTokens(copy);
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

  // ===== Discord link helper =====
  function discordLink(discord?: string): string | undefined {
    if (!discord) return;
    const v = discord.trim();

    // Direct URL
    if (/^https?:\/\//i.test(v)) return v;

    // Numeric User ID (17-20 digits)
    if (/^\d{17,20}$/.test(v)) return `https://discord.com/users/${v}`;

    // Otherwise (handle/username)—no official profile URL
    return undefined;
  }

  async function copyDiscordHandle(h: string) {
    try {
      await navigator.clipboard.writeText(h);
      alert(
        "Discord handle copied.\n\nTip: a direct profile link only works if you provide a numeric User ID (Settings → Advanced → Developer Mode → Copy ID)."
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

          {/* Select styled like .btn for consistency */}
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
            const canDelete = Boolean(myTokens[it.id]);
            const xHandle = it.x ? it.x.replace(/^@/, "") : "";
            const dHref = discordLink(it.discord);

            return (
              <div key={it.id} className="glass rounded-2xl p-3 card-hover flex flex-col">
                <img
                  src={it.url}
                  alt={it.title}
                  className="w-full h-56 object-contain rounded-xl bg-white/5"
                />

                <div className="mt-3">
                  <h3 className="font-semibold">{it.title}</h3>

                  {/* chips / actions */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {/* X: filter chip + profile link */}
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

                    {/* Discord: open if URL/ID, else copy handle */}
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
