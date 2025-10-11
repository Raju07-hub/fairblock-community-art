"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Item = {
  id: string;
  title: string;
  url: string;
  x?: string;
  discord?: string;
  createdAt: string;
  metaUrl: string;
  postUrl?: string; // NEW
};

function handleFromItem(it: Item): string {
  const x = (it.x || "").replace(/^@/, "");
  if (x) return `@${x}`;
  const d = (it.discord || "").replace(/^@/, "");
  return d ? `@${d}` : "";
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function GalleryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [patch, setPatch] = useState<{ title: string; x: string; discord: string; postUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/gallery", { cache: "no-store" });
      const j = await r.json();
      setItems(j?.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  function isOwner(it: Item): boolean {
    try {
      // token saved under fb:token:<id> at submit time
      const tok = localStorage.getItem(`fb:token:${it.id}`);
      return !!tok;
    } catch {
      return false;
    }
  }

  async function onDelete(it: Item) {
    if (!confirm("Delete this artwork? This cannot be undone.")) return;
    try {
      const token = localStorage.getItem(`fb:token:${it.id}`) || "";
      const res = await fetch(`/api/art/${encodeURIComponent(it.id)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, metaUrl: it.metaUrl }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Delete failed");
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  }

  function openEdit(it: Item) {
    setEditing(it);
    setPatch({
      title: it.title || "",
      x: it.x || "",
      discord: it.discord || "",
      postUrl: it.postUrl || "",
    });
    setMessage(null);
  }

  async function submitEdit() {
    if (!editing || !patch) return;
    setBusy(true);
    setMessage(null);
    try {
      // derive ownerTokenHash from deleteToken in localStorage
      const deleteToken = localStorage.getItem(`fb:token:${editing.id}`) || "";
      if (!deleteToken) throw new Error("Missing owner token in this browser.");
      const ownerTokenHash = await sha256Hex(deleteToken);

      const r = await fetch("/api/art/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metaUrl: editing.metaUrl,
          ownerTokenHash,
          patch: {
            title: patch.title.trim(),
            x: patch.x.trim(),
            discord: patch.discord.trim(),
            postUrl: patch.postUrl.trim(),
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Update failed");

      // Update local list
      setItems((prev) =>
        prev.map((it) =>
          it.id === editing.id
            ? {
                ...it,
                title: patch.title.trim(),
                x: patch.x.trim() || undefined,
                discord: patch.discord.trim() || undefined,
                postUrl: patch.postUrl.trim() || undefined,
              }
            : it
        )
      );
      setEditing(null);
    } catch (e: any) {
      setMessage(e?.message || "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/submit" className="btn">＋ Submit</Link>
        </div>
        <button className="btn" onClick={load} disabled={loading}>
          ↻ {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : items.length === 0 ? (
        <p className="opacity-70">No items yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {items.map((it) => {
            const owner = handleFromItem(it);
            const canEdit = isOwner(it);
            const xUrl = owner ? `https://x.com/${owner.replace(/^@/, "")}` : "";

            return (
              <div key={it.id} className="bg-white/5 rounded-2xl p-4 flex flex-col shadow">
                <div className="rounded-xl overflow-hidden bg-white/10 aspect-[4/3] mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.url}
                    alt={it.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="font-semibold">{it.title}</div>
                {owner && (
                  <div className="text-sm opacity-75 mt-1">
                    by{" "}
                    <a className="underline" href={xUrl} target="_blank" rel="noreferrer">
                      {owner}
                    </a>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/gallery?select=${encodeURIComponent(it.id)}`} className="btn">
                    See on Gallery
                  </Link>
                  {it.postUrl && (
                    <a className="btn" href={it.postUrl} target="_blank" rel="noreferrer">
                      Open Art Post
                    </a>
                  )}
                  {canEdit && (
                    <>
                      <button className="btn" onClick={() => openEdit(it)}>Edit</button>
                      <button className="btn bg-red-500 hover:bg-red-400" onClick={() => onDelete(it)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Edit Modal ===== */}
      {editing && patch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-[#0b0f14] rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Artwork</h3>
              <button className="btn" onClick={() => setEditing(null)}>✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1 opacity-80">Title</label>
                <input
                  className="input w-full"
                  value={patch.title}
                  onChange={(e) => setPatch({ ...patch, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1 opacity-80">X (Twitter) Handle</label>
                  <input
                    className="input w-full"
                    value={patch.x}
                    onChange={(e) => setPatch({ ...patch, x: e.target.value })}
                    placeholder="@yourhandle"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 opacity-80">Discord</label>
                  <input
                    className="input w-full"
                    value={patch.discord}
                    onChange={(e) => setPatch({ ...patch, discord: e.target.value })}
                    placeholder="@you#1234"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1 opacity-80">Your Art Post (X/Twitter)</label>
                <input
                  className="input w-full"
                  value={patch.postUrl}
                  onChange={(e) => setPatch({ ...patch, postUrl: e.target.value })}
                  placeholder="https://x.com/yourhandle/status/1234567890"
                />
              </div>
              {message && <p className="text-sm text-red-400">{message}</p>}
            </div>

            <div className="mt-5 flex gap-2">
              <button className="btn" onClick={submitEdit} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button className="btn" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
