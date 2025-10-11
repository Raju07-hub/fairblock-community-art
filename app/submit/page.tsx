"use client";

import { useState } from "react";

type ApiResp =
  | {
      success: true;
      id: string;
      url: string;
      metaUrl: string;
      ownerTokenHash: string;
      deleteToken: string;
    }
  | { success: false; error: string };

function cx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export default function SubmitPage() {
  const [title, setTitle] = useState("");
  const [x, setX] = useState("");
  const [discord, setDiscord] = useState("");
  const [postUrl, setPostUrl] = useState(""); // NEW
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function validPostUrl(s: string) {
    if (!s) return true;
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!title.trim()) return setMsg("Title is required.");
    if (!file) return setMsg("Please choose an image.");
    if (!validPostUrl(postUrl)) return setMsg("Your Art Post must be a valid URL.");

    const fd = new FormData();
    fd.append("title", title.trim());
    if (x.trim()) fd.append("x", x.trim());
    if (discord.trim()) fd.append("discord", discord.trim());
    if (postUrl.trim()) fd.append("postUrl", postUrl.trim()); // NEW
    fd.append("file", file);

    setBusy(true);
    try {
      const r = await fetch("/api/submit", { method: "POST", body: fd });
      const j = (await r.json()) as ApiResp;

      if (!("success" in j) || !j.success) {
        throw new Error((j as any)?.error || "Upload failed");
      }

      // 🔐 Save both deleteToken & ownerTokenHash so the user can Edit/Delete later.
      try {
        localStorage.setItem(`fb:token:${j.id}`, j.deleteToken);
        localStorage.setItem(`fb:ownerHash:${j.id}`, j.ownerTokenHash);
        // map metaUrl → id for convenience
        localStorage.setItem(`fb:meta:${j.metaUrl}`, j.id);
      } catch {}

      setMsg("Upload successful! You can find your art in the Gallery.");
      setTitle("");
      setX("");
      setDiscord("");
      setPostUrl("");
      setFile(null);
    } catch (e: any) {
      setMsg(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <h1 className="text-2xl font-bold mb-6">Submit Artwork</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 text-sm opacity-80">Title *</label>
          <input
            className="input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My awesome shroom"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm opacity-80">X (Twitter) Handle</label>
            <input
              className="input w-full"
              value={x}
              onChange={(e) => setX(e.target.value)}
              placeholder="@yourhandle"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm opacity-80">Discord</label>
            <input
              className="input w-full"
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
              placeholder="@you#1234"
            />
          </div>
        </div>

        {/* NEW: Your Art Post URL */}
        <div>
          <label className="block mb-1 text-sm opacity-80">Your Art Post (X/Twitter)</label>
          <input
            className={cx(
              "input w-full",
              postUrl && !validPostUrl(postUrl) && "ring-2 ring-red-500"
            )}
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://x.com/yourhandle/status/1234567890"
          />
          <p className="text-xs opacity-60 mt-1">
            Optional. If provided, your Gallery card will show “Open Art Post”.
          </p>
        </div>

        <div>
          <label className="block mb-1 text-sm opacity-80">Image (PNG/JPG/WEBP, max 8MB) *</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
        </div>

        {msg && <p className="text-sm">{msg}</p>}

        <button className="btn" disabled={busy}>
          {busy ? "Uploading…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
