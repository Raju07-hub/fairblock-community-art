"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Artwork = {
  id: string;
  title: string;
  url: string;
  x?: string;
  discord?: string;
  postUrl?: string;
  metaUrl?: string;
  createdAt?: string;
};

function getOwnerTokenFor(id: string): string | null {
  try {
    return (
      localStorage.getItem(`deleteToken:${id}`) ||
      localStorage.getItem("fairblock_delete_token") ||
      localStorage.getItem("deleteToken") ||
      null
    );
  } catch {
    return null;
  }
}

export default function EditArtworkPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<Artwork | null>(null);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [title, setTitle] = useState("");
  const [x, setX] = useState("");
  const [discord, setDiscord] = useState("");
  const [postUrl, setPostUrl] = useState("");

  const xProfile = useMemo(
    () => (x ? `https://x.com/${x.replace(/^@/, "")}` : ""),
    [x]
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/gallery", { cache: "no-store" });
      const j = await r.json();
      const found: Artwork | undefined = (j?.items || []).find((it: any) => String(it.id) === String(id));
      if (!found) {
        setError("Artwork not found.");
        setItem(null);
      } else {
        setItem(found);
        setTitle(found.title || "");
        setX(found.x || "");
        setDiscord(found.discord || "");
        setPostUrl(found.postUrl || "");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load artwork.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSave() {
    if (!item?.metaUrl) {
      alert("Missing meta URL for this artwork.");
      return;
    }
    const token = getOwnerTokenFor(item.id);
    if (!token) {
      alert("Owner token not found. You can only edit your own upload.");
      return;
    }

    setSaving(true);
    try {
      const r = await fetch("/api/art/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          metaUrl: item.metaUrl,
          patch: {
            title,
            x,
            discord,
            postUrl,
          },
        }),
      });
      const j = await r.json();
      if (!j?.success) {
        alert(j?.error || "Update failed");
        return;
      }
      // sukses → kembali ke gallery dengan kartu terpilih
      router.push(`/gallery?select=${encodeURIComponent(item.id)}`);
    } catch (e: any) {
      alert(e?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/gallery" className="btn">🖼️ Gallery</Link>
          {item && (
            <Link href={`/gallery?select=${encodeURIComponent(item.id)}`} className="btn">
              🔗 Permalink
            </Link>
          )}
        </div>
        <button onClick={load} className="btn" disabled={loading}>
          ↻ {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-4">Edit Artwork</h1>

      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : error ? (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4">
          <div className="font-medium text-red-200">{error}</div>
          <div className="mt-3">
            <Link href="/gallery" className="btn">← Back to Gallery</Link>
          </div>
        </div>
      ) : !item ? (
        <p className="opacity-70">Artwork not found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6">
          {/* Form */}
          <div className="rounded-2xl bg-white/5 p-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm opacity-80 mb-1">Title</label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-white/10 outline-none"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My awesome shroom"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm opacity-80 mb-1">X (Twitter) Handle</label>
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-white/10 outline-none"
                    value={x}
                    onChange={(e) => setX(e.target.value)}
                    placeholder="@yourhandle"
                  />
                  {x && (
                    <a
                      href={xProfile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline text-[#4af2ff] mt-1 inline-block"
                    >
                      Open X Profile
                    </a>
                  )}
                </div>
                <div>
                  <label className="block text-sm opacity-80 mb-1">Discord</label>
                  <input
                    className="w-full px-3 py-2 rounded-lg bg-white/10 outline-none"
                    value={discord}
                    onChange={(e) => setDiscord(e.target.value)}
                    placeholder="@you#1234"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm opacity-80 mb-1">Your Art Post (X/Twitter)</label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-white/10 outline-none"
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  placeholder="https://x.com/yourhandle/status/1234567890"
                />
                <p className="text-xs opacity-60 mt-1">
                  Optional. If provided, “Open Art Post” will show on your card.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button onClick={onSave} className="btn px-5" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <Link href={`/gallery?select=${encodeURIComponent(item.id)}`} className="btn bg-white/10">
                  Cancel
                </Link>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-2xl bg-white/5 p-5">
            <div className="rounded-xl overflow-hidden mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={title || item.title}
                className="w-full h-72 object-cover"
              />
            </div>
            <div className="font-semibold text-lg truncate mb-1">
              {title || item.title || "Untitled"}
            </div>
            <div className="text-sm opacity-80 space-x-2">
              {x && (
                <a
                  href={xProfile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[#4af2ff]"
                >
                  {x}
                </a>
              )}
              {discord && <span className="opacity-70">· {discord}</span>}
            </div>
            {postUrl && (
              <a
                href={postUrl}
                target="_blank"
                rel="noreferrer"
                className="btn mt-4 inline-flex"
              >
                Open Art Post
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
