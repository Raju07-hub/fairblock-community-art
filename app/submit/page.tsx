"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type TokenRec = {
  metaUrl?: string;        // lokasi metadata di Blob (penting untuk delete)
  ownerTokenHash?: string; // hash token dari server (informasi saja)
  token?: string;          // deleteToken legacy (fallback)
};

export default function SubmitPage() {
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ---- helpers --------------------------------------------------------------
  function validateAndPreview(f?: File) {
    if (!f) return;
    const okTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!okTypes.includes(f.type)) {
      alert("File must be PNG, JPG, or WEBP.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      alert("Maximum file size is 8MB.");
      return;
    }
    setFileName(f.name);
    setPreview(URL.createObjectURL(f));
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    validateAndPreview(f);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      if (fileInputRef.current) {
        const dt = new DataTransfer();
        dt.items.add(f);
        fileInputRef.current.files = dt.files;
      }
      validateAndPreview(f);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  // ---- submit ---------------------------------------------------------------
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    setLoading(true);
    try {
      const res = await fetch("/api/submit", { method: "POST", body: fd });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || "Non-JSON response");
      }
      if (!res.ok || !data?.success) throw new Error(data?.error || "Upload failed");

      // ✅ Simpan credential untuk delete (owner)
      try {
        const raw = localStorage.getItem("fairblock_tokens");
        const map: Record<string, TokenRec> = raw ? JSON.parse(raw) : {};
        map[data.id] = {
          metaUrl: data.metaUrl,
          ownerTokenHash: data.ownerTokenHash,
          token: data.deleteToken, // fallback legacy
        };
        localStorage.setItem("fairblock_tokens", JSON.stringify(map));
      } catch {}

      alert("Upload successful!");
      form.reset();
      setPreview(null);
      setFileName("");
      router.push("/gallery");
    } catch (err: any) {
      alert(err?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  // ---- ui -------------------------------------------------------------------
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10">
      {/* Top nav */}
      <div className="flex gap-3 mb-6">
        <a href="/" className="btn">⬅ Back to Home</a>
        <a href="/gallery" className="btn">View Gallery</a>
      </div>

      <h1 className="text-3xl font-bold text-gradient mb-6">Submit Your Art</h1>

      <form onSubmit={onSubmit} className="glass rounded-2xl p-5 space-y-4">
        <input
          name="title"
          placeholder="Title — e.g. Confidential Beam"
          required
          className="w-full px-4 py-3 rounded-xl bg-white/10 placeholder-white/60 focus:outline-none"
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <input
            name="x"
            placeholder="Username X — e.g. @kanjuro"
            className="w-full px-4 py-3 rounded-xl bg-white/10 placeholder-white/60 focus:outline-none"
          />
          <input
            name="discord"
            placeholder="Username Discord — e.g. name#1234 or user ID"
            className="w-full px-4 py-3 rounded-xl bg-white/10 placeholder-white/60 focus:outline-none"
          />
        </div>

        {/* DROPZONE */}
        <label
          className={`dropzone ${isDragging ? "dropzone--active" : ""} block`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          aria-label="Drop image here or click to choose"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
        >
          <input
            ref={fileInputRef}
            name="file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFilePick}
            required
            className="hidden"
          />
          <div className="dropzone__hint">
            {fileName ? `Selected: ${fileName}` : "Drag & drop image here, or click to choose"}
          </div>
          <div className="dropzone__sub">Format: PNG / JPG / WEBP — Max 8MB</div>
        </label>

        {preview && (
          <div className="mt-4 flex justify-center">
            <img
              src={preview}
              alt="preview"
              className="w-80 h-80 object-contain rounded-2xl bg-white/5"
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn">
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
