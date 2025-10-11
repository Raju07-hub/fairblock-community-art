// app/edit/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type GalleryItemLite = {
  id: string;
  title: string;
  url: string;
  x?: string;
  discord?: string;
  createdAt: string;
  metaUrl: string;
  postUrl?: string;
};

type MetaFile = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  imageUrl?: string;
  url?: string; // legacy
  postUrl?: string;
  createdAt?: string;
  ownerTokenHash?: string;
  deleteToken?: string; // legacy
};

const btn = "btn px-4 py-1 rounded-full text-sm";

function getTokenMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("fairblock:tokens") || "{}") || {};
  } catch {
    return {};
  }
}
function getOwnerTokenFor(id: string) {
  const m = getTokenMap();
  return m[id] || null;
}

export default function EditArtworkPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const artId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<GalleryItemLite | null>(null);

  // form fields
  const [title, setTitle] = useState("");
  const [x, setX] = useState("");
  const [discord, setDiscord] = useState("");
  const [postUrl, setPostUrl] = useState("");

  const token = useMemo(() => (artId ? getOwnerTokenFor(artId) : null), [artId]);

  useEffect(() => {
    let alive = true;
    async function init() {
      if (!artId) return;
      setLoading(true);
      setError(null);
      try {
        // 1) get gallery list (latest); find by id to obtain metaUrl + image url quickly
        const g = await fetch("/api/gallery", { cache: "no-store" }).then((r) => r.json());
        const it: GalleryItemLite | undefined = (g?.items || []).find((x: any) => x.id === artId);
        if (!alive) return;

        if (!it) {
          setError("Artwork not found.");
          setLoading(false);
          return;
        }
        setItem(it);

        // 2) fetch full meta file to prefill (ensures postUrl etc.)
        let meta: MetaFile | null = null;
        try {
          const res = await fetch(it.metaUrl, { cache: "no-store" });
          if (res.ok) meta = (await res.json()) as MetaFile;
        } catch {}

        setTitle((meta?.title ?? it.title) || "");
        setX((meta?.x ?? it.x ?? "").toString());
        setDiscord((meta?.discord ?? it.discord ?? "").toString());
        setPostUrl((meta?.postUrl ?? it.postUrl ?? "").toString());
      } catch (e: any) {
        setError(e?.message || "Failed to load artwork.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    init();
    return () => {
      alive = false;
    };
  }, [artId]);

  async function onSave() {
    if (!item) return;
    if (!token) {
      alert("Owner token not found for this artwork. You can only edit your own upload on this device.");
      return;
    }
    if (!title.trim()) {
      alert("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        id: item.id,
        token,
        metaUrl: item.metaUrl,
        patch: {
          title: title.trim(),
          x: x.trim(),
          discord: discord.trim(),
          postUrl: postUrl.trim(),
        },
      };
      const j = await fetch("/api/art/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());

      if (!j?.success) {
        throw new Error(j?.error || "Update failed");
      }
      // sukses: kembali ke gallery, seleksi karya ini
      router.push(`/gallery?select=${encodeURIComponent(item.id)}&updated=1`);
    } catch (e: any) {
      setError(e?.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/gallery" className={btn}>
            ← Back to Gallery
          </Link>
          <Link href={`/gallery?select=${encodeURIComponent(artId || "")}`} className={btn}>
            View Artwork
          </Link>
        </div>
        <Link href="/leaderboard" className={btn}>
          🏆 Leaderboard
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">Edit Artwork</h1>
      <p className="text-white/70 mb-6">
        Update your artwork metadata. Only the original uploader (on the same device) can edit using the local owner token.
      </p>

      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-500/20 border border-red-400/40 text-red-200">{error}</div>
      ) : !item ? (
        <p className="opacity-70">Artwork not found.</p>
      ) : !token ? (
        <div className="p-4 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-100">
          We couldn’t find the owner token for this artwork on this device. You can only edit items you uploaded from this
          browser. If you just submitted, make sure the page saved your token (it’s automatic).
        </div>
      ) : (
        <>
          {/* Preview */}
          <div className="rounded-2xl overflow-hidden bg-white/5 shadow-md mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={title || item.title}
              className="w-full aspect-[16/9] object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>

          {/* Form */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm mb-1 opacity-80">Title *</label>
              <input
                className="w-full rounded-xl bg-white/10 px-4 py-2 outline-none"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Your artwork title"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 opacity-80">X (Twitter) Handle</label>
                <input
                  className="w-full rounded-xl bg-white/10 px-4 py-2 outline-none"
                  value={x}
                  onChange={(e) => setX(e.target.value)}
                  placeholder="@yourname"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 opacity-80">Discord</label>
                <input
                  className="w-full rounded-xl bg-white/10 px-4 py-2 outline-none"
                  value={discord}
                  onChange={(e) => setDiscord(e.target.value)}
                  placeholder="@you#1234"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 opacity-80">Your Art Post (X/Twitter)</label>
              <input
                className="w-full rounded-xl bg-white/10 px-4 py-2 outline-none"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://x.com/yourhandle/status/1234567890"
              />
              <p className="text-xs opacity-60 mt-1">
                Optional. If provided, your Gallery card and Leaderboard will show an “Open Art Post” button.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button disabled={saving} onClick={onSave} className={btn}>
                💾 {saving ? "Saving…" : "Save Changes"}
              </button>
              <Link href={`/gallery?select=${encodeURIComponent(item.id)}`} className={btn}>
                Cancel
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
