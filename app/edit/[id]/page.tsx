"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Artwork = {
  id: string;
  title: string;
  url: string;
  x?: string;
  discord?: string;
  metaUrl: string;
  postUrl?: string;
};

function getOwnerTokenFor(id: string): string | null {
  try {
    const raw = localStorage.getItem("fairblock:tokens");
    if (!raw) return null;
    const map = JSON.parse(raw || "{}");
    return map?.[id] || null;
  } catch {
    return null;
  }
}

export default function EditArtworkPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [item, setItem] = useState<Artwork | null>(null);
  const [title, setTitle] = useState("");
  const [x, setX] = useState("");
  const [discord, setDiscord] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load artwork (termasuk metaUrl) dari /api/gallery lalu filter by id
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const j = await fetch("/api/gallery", { cache: "no-store" }).then((r) => r.json());
        const list: Artwork[] = j?.items || [];
        const found = list.find((a) => a.id === id) || null;
        if (!found) {
          alert("Artwork not found.");
          router.push("/gallery");
          return;
        }
        setItem(found);
        setTitle(found.title || "");
        setX(found.x || "");
        setDiscord(found.discord || "");
        setPostUrl(found.postUrl || "");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  async function onSave() {
    if (!item) return;

    const token = getOwnerTokenFor(item.id);
    if (!token) {
      alert("Delete/Edit token not found. Gunakan browser yg sama saat submit.");
      return;
    }
    if (!item.metaUrl) {
      alert("Missing metaUrl on this artwork.");
      return;
    }

    setSaving(true);
    try {
      const patch = {
        title: title.trim(),
        x: x.trim(),
        discord: discord.trim(),
        postUrl: postUrl.trim(),
      };

      const resp = await fetch(`/api/art/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, metaUrl: item.metaUrl, patch }),
      });

      // --- PARSE RESPON AMAN (204 / non-JSON) ---
      let data: any = null;
      const ct = resp.headers.get("content-type") || "";
      if (resp.status === 204) {
        data = { success: true };
      } else if (ct.includes("application/json")) {
        data = await resp.json();
      } else {
        const text = await resp.text().catch(() => "");
        data = resp.ok ? { success: true } : { success: false, error: text || resp.statusText };
      }

      if (!resp.ok || data?.success === false) {
        throw new Error(data?.error || `${resp.status} ${resp.statusText}`);
      }

      alert("Saved.");
      router.push("/gallery");
    } catch (e: any) {
      alert(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-5 sm:px-6 py-10">
        <div className="mb-5 flex gap-3">
          <button className="btn" onClick={() => router.back()}>
            ⬅ Back
          </button>
          <Link className="btn" href="/gallery">
            🏞️ Gallery
          </Link>
        </div>
        <p className="opacity-70">Loading…</p>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="max-w-2xl mx-auto px-5 sm:px-6 py-10">
      {/* Back buttons */}
      <div className="mb-5 flex gap-3">
        <button className="btn" onClick={() => router.back()}>
          ⬅ Back
        </button>
        <Link className="btn" href="/gallery">
          🏞️ Gallery
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">Edit Artwork</h1>

      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="w-full rounded-xl overflow-hidden bg-white/5">
          <img src={item.url} alt={item.title} className="w-full aspect-[4/3] object-cover" />
        </div>

        <label className="block">
          <div className="mb-1 text-sm opacity-80">Title</div>
          <input
            className="w-full px-4 py-2 rounded-xl bg-white/10 outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <div className="mb-1 text-sm opacity-80">X (Twitter) Handle</div>
            <input
              className="w-full px-4 py-2 rounded-xl bg-white/10 outline-none"
              value={x}
              onChange={(e) => setX(e.target.value)}
              placeholder="@username"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-sm opacity-80">Discord</div>
            <input
              className="w-full px-4 py-2 rounded-xl bg-white/10 outline-none"
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
              placeholder="yourname"
            />
          </label>
        </div>

        <label className="block">
          <div className="mb-1 text-sm opacity-80">Art Post URL (X/Twitter)</div>
          <input
            className="w-full px-4 py-2 rounded-xl bg-white/10 outline-none"
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://x.com/…"
          />
        </label>

        <div className="pt-2 flex gap-3">
          <button onClick={onSave} disabled={saving} className="btn">
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button className="btn" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
