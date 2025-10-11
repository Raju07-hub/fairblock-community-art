"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditArtPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [x, setX] = useState("");
  const [discord, setDiscord] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [metaUrl, setMetaUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // ambil daftar meta untuk menemukan metaUrl item ini
        const g = await fetch("/api/gallery", { cache: "no-store" }).then(r => r.json());
        const item = (g?.items || []).find((it: any) => it.id === id);
        if (!item) {
          alert("Artwork not found.");
          router.push("/gallery");
          return;
        }
        setTitle(item.title || "");
        setX(item.x || "");
        setDiscord(item.discord || "");
        setPostUrl(item.postUrl || "");
        setMetaUrl(item.metaUrl || "");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const raw = localStorage.getItem("fairblock:tokens");
    const map = raw ? JSON.parse(raw) : {};
    const token = map?.[id];
    if (!token) {
      alert("Owner token not found. Use the same browser you used to submit.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/art/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, token, metaUrl, title, x, discord, postUrl }),
      });
      const j = await r.json();
      if (!j?.success) throw new Error(j?.error || "Update failed");
      alert("Saved.");
      router.push("/gallery");
    } catch (e: any) {
      alert(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Edit Artwork</h1>
      <form onSubmit={onSave} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 rounded bg-white/10" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">X (Twitter) Handle</label>
            <input value={x} onChange={e => setX(e.target.value)} placeholder="@you" className="w-full px-3 py-2 rounded bg-white/10" />
          </div>
          <div>
            <label className="block text-sm mb-1">Discord</label>
            <input value={discord} onChange={e => setDiscord(e.target.value)} placeholder="you#1234" className="w-full px-3 py-2 rounded bg-white/10" />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Art Post URL (X/Twitter)</label>
          <input value={postUrl} onChange={e => setPostUrl(e.target.value)} placeholder="https://x.com/handle/status/..." className="w-full px-3 py-2 rounded bg-white/10" />
        </div>
        <button disabled={saving} className="btn">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
