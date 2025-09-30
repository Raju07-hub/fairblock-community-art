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
  metaUrl?: string; // required for delete (owner/admin)
};

type TokenRec = {
  metaUrl?: string;
  ownerTokenHash?: string;
  token?: string; // legacy deleteToken fallback
};

const PUBLIC_ADMIN_UI = process.env.NEXT_PUBLIC_ADMIN_UI === "true";

export default function GalleryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [onlyMine, setOnlyMine] = useState(false);
  const [myTokens, setMyTokens] = useState<Record<string, TokenRec>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Admin UI (optional)
  const [adminMode, setAdminMode] = useState(false);
  const [adminKey, setAdminKey] = useState<string>("");

  // Load data
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

    if (PUBLIC_ADMIN_UI) {
      setAdminKey(sessionStorage.getItem("fairblock_admin_key") || "");
      setAdminMode(sessionStorage.getItem("fairblock_admin_mode") === "1");
    }
  }, []);

  // Derived list
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

  // Helpers
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
        "Discord handle copied.\n\nTip: Direct profile link works only if you provide the numeric User ID (enable Developer Mode in Discord then copy ID)."
      );
    } catch {
      alert("Failed to copy handle.");
    }
  }

  function filterByUsername(name: string) {
    const clean = name.trim();
    if (!clean) return;
    setQuery(clean.startsWith("@") ? clean.toLowerCase() : `@${clean.toLowerCase()}`);
  }

  // Admin toggle (prompt once)
  function toggleAdminMode(next: boolean) {
    if (!PUBLIC_ADMIN_UI) return;
    if (next && !adminKey) {
      const k = window.prompt("Enter ADMIN_KEY to enable Admin Mode:");
      if (!k) return;
      setAdminKey(k);
      sessionStorage.setItem("fairblock_admin_key", k);
    }
    setAdminMode(next);
    sessionStorage.setItem("fairblock_admin_mode", next ? "1" : "0");
  }

  // DELETE (owner/admin)
  async function handleDelete(id: string, asAdmin = false) {
    const tokenRec = myTokens[id]; // { metaUrl, token, ownerTokenHash }
    const metaUrl = tokenRec?.metaUrl || items.find((it) => it.id === id)?.metaUrl;

    if (!asAdmin) {
      if (!tokenRec?.token && !metaUrl) {
        return alert("You don't have permission to delete this item.");
      }
      if (!confirm("Delete this artwork?")) return;
    } else {
      if (!PUBLIC_ADMIN_UI || !adminMode) return;
      if (!adminKey) {
        const k = window.prompt("Enter ADMIN_KEY:");
        if (!k) return;
        setAdminKey(k);
        sessionStorage.setItem("fairblock_admin_key", k);
      }
      if (!metaUrl) {
        return alert("Missing metaUrl (cannot admin-delete).");
      }
      if (!confirm("Delete this artwork as ADMIN? This cannot be undone.")) return;
    }

    setLoadingId(id);
    try {
      const res = await fetch(`/api/art/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(asAdmin && adminKey ? { "x-admin-key": adminKey } : {}),
        },
        body: JSON.stringify({
          token: tokenRec?.token,      // owner path: may be present (legacy)
          metaUrl,                     // REQUIRED for both owner/admin
        }),
      });

      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Delete failed");

      // Remove from UI
      setItems((prev) => prev.filter((it) => it.id !== id));

      // Clean local storage (owner path)
      if (!asAdmin) {
        const copy = { ...myTokens };
        delete copy[id];
        localStorage.setItem("fairblock_tokens", JSON.stringify(copy));
        setMyTokens(copy);
      }
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setLoadingId(null);
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

          {PUBLIC_ADMIN_UI && (
            <label className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-full cursor-pointer select-none">
              <input
                type="checkbox"
                checked={adminMode}
                onChange={(e) => toggleAdminMode(e.target.checked)}
                className="accent-white"
              />
              <span className="text-sm">
                Admin Mode
                {adminMode && <span className="ml-2 text-white/60">••••••••••••••</span>}
              </span>
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
        {PUBLIC_ADMIN_UI && adminMode && <span className="ml-3">• <b>Admin Mode ON</b></span>}
      </p>

      {filtered.length === 0 ? (
        <p className="text-white/70">No results found.</p>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {filtered.map((it) => {
            const canDelete = Boolean(myTokens[it.id]);
            const xHandle = it.x ? it.x.replace(/^@/, "") : "";
            const dHref = discordLink(it.discord);

            return (
              <div key={it.id} className="glass rounded-2xl p-3 card-hover flex flex-col">
                {/* Image: full view inside square (no crop) */}
                <img
                  src={it.url}
                  alt={it.title}
                  className="w-full aspect-square object-contain rounded-xl bg-white/5"
                />

                <div className="mt-3">
                  <h3 className="font-semibold">{it.title}</h3>

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

                    {/* Discord: link (if possible) or copy handle */}
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
                {canDelete && (
                  <button
                    onClick={() => handleDelete(it.id, false)}
                    className="btn-ghost mt-3 text-sm text-red-400 hover:text-red-300"
                    disabled={loadingId === it.id}
                    title="Delete this artwork (uploader only)"
                  >
                    {loadingId === it.id ? "Deleting..." : "🗑 Delete"}
                  </button>
                )}

                {/* Admin delete (tiny & discreet) */}
                {PUBLIC_ADMIN_UI && adminMode && (
                  <button
                    onClick={() => handleDelete(it.id, true)}
                    className="btn-ghost mt-1 text-[12px] self-start opacity-60 hover:opacity-100 text-pink-400"
                    disabled={loadingId === it.id}
                    title="Admin delete (requires ADMIN_KEY)"
                  >
                    {loadingId === it.id ? "Deleting..." : "🗑 Delete (Admin)"}
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
