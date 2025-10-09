// app/gallery/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ArtworkCard from "@/components/ArtworkCard";

type Item = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  url: string;
  createdAt: string;
  metaUrl?: string;
  likes?: number;
  liked?: boolean;
};

type TokenRec = {
  metaUrl?: string;
  ownerTokenHash?: string;
  token?: string;
};

const ADMIN_UI = process.env.NEXT_PUBLIC_ADMIN_UI === "true";

function xHandle(x?: string) {
  return (x || "").replace(/^@/, "");
}
function handleFromItem(it: Item): string {
  const x = xHandle(it.x);
  if (x) return `@${x}`;
  const d = (it.discord || "").replace(/^@/, "");
  return d ? `@${d}` : "";
}

function getAdminKeyFromSession(): string | null {
  try {
    let k = sessionStorage.getItem("fb_admin_key");
    if (!k) {
      k = prompt("Enter ADMIN_KEY:") || "";
      if (k) sessionStorage.setItem("fb_admin_key", k);
    }
    return k || null;
  } catch {
    return null;
  }
}

export default function GalleryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // query params support
  const qParam = (params.get("q") || "").trim();
  const selectParam = params.get("select") || "";

  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState(qParam); // initial from ?q=
  const [sort, setSort] = useState<"new" | "old">("new");
  const [onlyMine, setOnlyMine] = useState(false);
  const [myTokens, setMyTokens] = useState<Record<string, TokenRec>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState<boolean>(false);

  // Keep URL in sync when query changes (so shareable link persists)
  useEffect(() => {
    const current = new URLSearchParams(Array.from(params.entries()));
    if (query) current.set("q", query);
    else current.delete("q");
    const next = `${pathname}?${current.toString()}`.replace(/\?$/, "");
    // only replace if different
    const now = `${pathname}?${params.toString()}`.replace(/\?$/, "");
    if (next !== now) router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // If URL ?q= changed externally (e.g., from a link), reflect into input
  useEffect(() => {
    if ((qParam || "") !== (query || "")) setQuery(qParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam]);

  // initial load + tarik likes & liked status dari server
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/gallery", { cache: "no-store" });
      const json = await res.json().catch(() => ({} as any));
      if (json?.success) {
        const base: Item[] = json.items || [];
        setItems(base);

        try {
          const ids = base.map((i) => i.id).join(",");
          if (ids) {
            const r = await fetch(`/api/likes?ids=${encodeURIComponent(ids)}`, {
              cache: "no-store",
            });
            const j = await r.json().catch(() => ({}));
            if (j?.success && j.data) {
              setItems((prev) =>
                prev.map((it) => {
                  const d = j.data[it.id];
                  return d
                    ? { ...it, likes: Number(d.count || 0), liked: !!d.liked }
                    : it;
                })
              );
            }
          }
        } catch {}
      }
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

  const filtered = useMemo(() => {
    let list = [...items];
    if (onlyMine) list = list.filter((it) => !!myTokens[it.id]);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((it) => {
        const handle = handleFromItem(it).toLowerCase();
        const s = `${it.title || ""} ${it.x || ""} ${it.discord || ""} ${handle}`.toLowerCase();
        return s.includes(q) || it.id.toLowerCase().includes(q);
      });
    }
    list.sort((a, b) =>
      sort === "new"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return list;
  }, [items, query, sort, onlyMine, myTokens]);

  // Auto-scroll + highlight when ?select=<id>
  useEffect(() => {
    if (!selectParam) return;
    // wait a tick to ensure items rendered
    const t = setTimeout(() => {
      const el = document.getElementById(`art-${selectParam}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-pink-500");
        setTimeout(() => el.classList.remove("ring-2", "ring-pink-500"), 1600);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [selectParam, filtered.length]);

  // delete
  async function onDelete(id: string, metaUrl?: string, isAdmin = false) {
    const confirmText = isAdmin ? "Delete this artwork as ADMIN?" : "Delete this artwork?";
    if (!confirm(confirmText)) return;
    setDeleting(id);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: any = {};

      if (isAdmin) {
        const adminKey = getAdminKeyFromSession();
        if (!adminKey) throw new Error("ADMIN_KEY is missing.");
        if (!metaUrl) throw new Error("Missing token or metaUrl");
        headers["x-admin-key"] = adminKey;
        body = { metaUrl };
      } else {
        const rec = myTokens[id];
        if (!rec?.metaUrl) throw new Error("Missing token or metaUrl");
        body = { token: rec.token, metaUrl: rec.metaUrl };
      }

      const res = await fetch(`/api/art/${id}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "Delete failed");

      alert(isAdmin ? "Admin delete success." : "Deleted successfully.");
      setItems((prev) => prev.filter((x) => x.id !== id));

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

  // like handler: sync dari server (count & liked)
  async function likeOne(id: string): Promise<void> {
    const it = items.find((x) => x.id === id);
    if (!it) throw new Error("Item not found");
    const author = xHandle(it.x) || it.discord || "";

    const r = await fetch("/api/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, author }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.success) throw new Error(j?.error || "Like failed");

    setItems((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, liked: Boolean(j.liked), likes: Number(j.count ?? (x.likes || 0)) }
          : x
      )
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/submit" className="btn">＋ Submit Art</Link>
          <Link href="/leaderboard" className="btn">🏆 Leaderboard</Link>
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
        <p className="text-white/70">No results found.</p>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
          {filtered.map((it) => {
            const mine = !!myTokens[it.id];
            return (
              <div key={it.id} id={`art-${it.id}`} className="flex flex-col">
                <ArtworkCard item={it} onLike={likeOne} />
                <div className="mt-2 text-xs opacity-70">
                  {handleFromItem(it)} · {it.id}
                </div>

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
