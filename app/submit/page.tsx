"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function normAt(v: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.startsWith("@") ? s : `@${s}`;
}

export default function SubmitPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [x, setX] = useState("");
  const [discord, setDiscord] = useState("");
  const [postUrl, setPostUrl] = useState(""); // NEW optional
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onPick = (f?: File | null) => {
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
      alert("Please choose PNG, JPG, or WEBP.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      alert("Max file size is 8MB.");
      return;
    }
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    onPick(f || null);
  }, []);

  const onSubmit = async () => {
    if (busy) return;
    if (!title.trim()) return alert("Title is required.");
    if (!file) return alert("Please choose an image.");

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("x", normAt(x));
      fd.append("discord", normAt(discord));
      fd.append("postUrl", postUrl.trim());
      fd.append("file", file);

      const res = await fetch("/api/submit", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false)
        throw new Error(data?.error || `${res.status} ${res.statusText}`);

      // simpan token owner untuk edit/delete
      const id: string = data.id;
      const deleteToken: string = data.deleteToken;
      if (id && deleteToken) {
        const RAW = localStorage.getItem("fairblock:tokens");
        const map = RAW ? JSON.parse(RAW) : {};
        map[id] = deleteToken;
        localStorage.setItem("fairblock:tokens", JSON.stringify(map));
      }

      alert("Submitted successfully! ✨ Redirecting to Gallery...");
      router.replace(`/gallery?refresh=${Date.now()}`);
    } catch (e: any) {
      alert(e?.message || "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="btn">⬅ Back to Home</Link>
        <Link href="/gallery" className="btn">View Gallery</Link>
      </div>

      <h1 className="text-3xl font-bold mb-6 text-white/90">Submit Your Art</h1>

      {/* Form container (lebih kecil dan padat) */}
      <div className="glass rounded-2xl p-6 border border-white/10 space-y-5">
        {/* Title */}
        <label className="block">
          <div className="mb-1 text-sm opacity-80">Title</div>
          <input
            className="w-full px-4 py-2.5 rounded-xl bg-white/10 outline-none"
            placeholder="Title — e.g. Confidential Beam"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        {/* Handles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <div className="mb-1 text-sm opacity-80">Username X</div>
            <input
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 outline-none"
              placeholder="e.g. @kanjuro"
              value={x}
              onChange={(e) => setX(e.target.value)}
            />
          </label>
          <label className="block">
            <div className="mb-1 text-sm opacity-80">Username Discord</div>
            <input
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 outline-none"
              placeholder="e.g. name#1234 or username"
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
            />
          </label>
        </div>

        {/* Art Post URL (optional) */}
        <label className="block">
          <div className="mb-1 text-sm opacity-80">Your Art Post (X/Twitter) — optional</div>
          <input
            className="w-full px-4 py-2.5 rounded-xl bg-white/10 outline-none"
            placeholder="https://x.com/yourhandle/status/1234567890"
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
          />
          <div className="text-xs opacity-60 mt-1">
            If provided, your Gallery card will show “Open Art Post”.
          </div>
        </label>

        {/* File upload area */}
        <div
          className={`rounded-2xl border-2 border-dashed ${
            dragOver ? "border-white/60" : "border-white/20"
          } bg-black/30 p-6 text-center transition`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <p className="mb-1 text-sm">Drag & drop image here, or click to choose</p>
          <p className="text-xs opacity-70 mb-2">Format: PNG / JPG / WEBP — Max 8MB</p>

          {file && (
            <div className="mt-2 text-sm opacity-80">
              Selected: <span className="font-medium">{file.name}</span>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => onPick(e.target.files?.[0] || null)}
          />
        </div>

        {/* Submit buttons */}
        <div className="flex gap-3 pt-2">
          <button onClick={onSubmit} disabled={busy} className="btn">
            {busy ? "Submitting…" : "Submit"}
          </button>
          <Link href="/gallery" className="btn">Cancel</Link>
        </div>
      </div>
    </div>
  );
}
