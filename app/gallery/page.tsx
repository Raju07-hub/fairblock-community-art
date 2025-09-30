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
  metaUrl?: string; // returned by /api/gallery (Blob metadata URL)
};

type TokenRec = {
  token?: string;        // legacy deleteToken (owner-side)
  metaUrl?: string;      // stored at submit time (new flow)
  ownerTokenHash?: string; // informational; not used client-side
};

const ADMIN_UI = process.env.NEXT_PUBLIC_ADMIN_UI === "true";

export default function GalleryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [onlyMine, setOnlyMine] = useState(false);
  const [myTokens, setMyTokens] = useState<Record<string, TokenRec>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);

  // ------- load gallery + my tokens -------
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/gallery", { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    })();
    try {
      const raw = localStorage.getItem("fairblock_tokens");
      setMyTokens(raw ? JSON.parse(raw) : {});
    } catch {}
    if (ADMIN_UI) {
      setAdminMode(sessionStorage.getItem("fairblock_admin_mode") === "1");
    }
  }, []);

  // ------- filtering / sorting -------
  const filtered = useMemo(() => {
    let list = [...items];

    if (onlyMine) {
      list = list.filter((it) => Boolean(myTokens[it.id]?.token));
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (it) =>
          it.title?.toLowerCase().includes(q) ||
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

  // ------- utils -------
  function filterByUsernameX(handle: string) {
    if (!handle) return;
    const clean = handle.startsWith("@") ? handle : `@${handle}`;
    setQuery(clean.toLowerCase());
  }

  function discordLink(discord?: string): string | undefined {
    if (!discord) return;
    const v = discord.trim();
    if (/^https?:\/\//i.test(v)) return v; // already a URL
    if (/^\d{17,20}$/.test(v)) return `https://discord.com/users/${v}`; // user ID
    return undefined; // regular handle (no direct profile URL)
  }

  async function copyText(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      alert("Copied to clipboard.");
    } catch {
      alert("Copy failed.");
    }
  }

  // ------- Delete (Owner or Admin) -------
  async function handleDeleteOwner(it: Item) {
    const rec = myTokens[it.id];
    const token = rec?.token;
    const metaUrl = it.metaUrl || rec?.metaUrl; // prefer metaUrl from API

    if (!token || !metaUrl) {
      alert("Missing token or metaUrl");
      return;
    }
    if (!confirm("Delete this artwork?")) return;

    setLoadingId(it.id);
    try {
      const res = await fetch(`/api/art/${it.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, metaUrl }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Delete failed");

      // remove from UI
      setItems((prev) => prev.filter((x) => x.id !== it.id));

      // cleanup local token store
      try {
        const copy = { ...myTokens };
        delete copy[it.id];
        localStorage.setItem("fairblock_tokens", JSON.stringify(copy));
        setMyTokens(copy);
      } catch {}
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDeleteAdmin(it: Item) {
    if (!ADMIN_UI) return;

    const metaUrl = it.metaUrl;
    if (!metaUrl) {
      alert("Missing token or metaUrl");
      return;
    }
    // get Admin Key once per session
    let adminKey = sessionStorage.getItem("fairblock_admin_key") || "";
    if (!adminKey) {
      adminKey = prompt("Enter Admin Key:") || "";
      if (!adminKey) return;
      sessionStorage.setItem("fairblock_admin_key", adminKey);
    }

    if (!confirm("Admin: delete this artwork? This cannot be undone.")) return;

    setLoadingId(it.id);
    try {
      const res = await fetch(`/api/art/${it.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ metaUrl }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Delete failed");
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    } finally {
      setLoadingId(null);
    }
  }

  // ------- UI -------
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
            title="Sort"
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
                  sessionStorage.setItem("fairblock_admin_mode", on ? "1" : "0");
                }}
                className="accent-white"
              />
              <span className="text-sm">Admin Mode</span>
            </label>
          )}

          {!!query && (
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
        {query && <span className="ml-2">for <span className="text-gradient">{query}</span></span>}
      </p>

      {filtered.length === 0 ? (
        <p className="text-white/70">No results.</p>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
          {filtered.map((it) => {
            const rec = myTokens[it.id];
            const canOwnerDelete = Boolean(rec?.token); // uploader only
            const xHandle = it.x ? it.x.replace(/^@/, "") : "";
            const dHref = discordLink(it.discord);

            return (
              <div key={it.id} className="glass rounded-2xl p-3 card-hover flex flex-col">
                {/* image uses object-contain so artwork isn't cropped */}
                <img
                  src={it.url}
                  alt={it.title}
                  className="w-full h-56 object-contain rounded-xl bg-white/5"
                />

                <div className="mt-3 flex-1">
                  <h3 className="font-semibold">{it.title}</h3>

                  {/* chips */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {it.x && (
                      <>
                        <button
                          className="btn-ghost text-sm px-3 py-1"
                          onClick={() => filterByUsernameX(it.x!)}
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
                            Open Discord
                          </a>
                        ) : (
                          <button
                            onClick={() => copyText(it.discord!)}
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

                {/* Owner Delete */}
                {canOwnerDelete && (
                  <button
                    onClick={() => handleDeleteOwner(it)}
                    className="btn-ghost mt-3 text-red-400 hover:text-red-300"
                    disabled={loadingId === it.id}
                    title="Delete (uploader only)"
                  >
                    {loadingId === it.id ? "Deleting..." : "🗑 Delete"}
                  </button>
                )}

                {/* Admin Delete (tiny, gated, unobtrusive) */}
                {ADMIN_UI && adminMode && (
                  <button
                    onClick={() => handleDeleteAdmin(it)}
                    className="self-start mt-2 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3 py-1 rounded"
                    disabled={loadingId === it.id}
                    title="Admin Delete"
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
