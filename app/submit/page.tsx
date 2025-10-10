"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type TokenRec = {
  metaUrl?: string;
  ownerTokenHash?: string;
  token?: string;
};

const MAX_BYTES = 8 * 1024 * 1024;      // 8 MB
const TARGET_BYTES = 7.9 * 1024 * 1024; // target sedikit di bawah 8MB
const MAX_SIDE = 4096;                  // batasi sisi terpanjang jika gambar sangat besar

export default function SubmitPage() {
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [workingFile, setWorkingFile] = useState<File | null>(null);

  function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async function compressIfNeeded(original: File): Promise<File> {
    if (!/^image\/(png|jpeg|webp)$/i.test(original.type)) return original;
    if (original.size <= MAX_BYTES) return original;

    const targetMime = original.type === "image/jpeg" ? "image/jpeg" : "image/webp";

    const blobUrl = URL.createObjectURL(original);
    const img = await createImage(blobUrl);
    URL.revokeObjectURL(blobUrl);

    let { width, height } = img;
    const longSide = Math.max(width, height);
    if (longSide > MAX_SIDE) {
      const scale = MAX_SIDE / longSide;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, width, height);

    let lo = 0.5, hi = 0.95, bestBlob: Blob | null = null;
    for (let i = 0; i < 8; i++) {
      const q = (lo + hi) / 2;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), targetMime, q)
      );
      if (!blob) break;
      if (blob.size > TARGET_BYTES) hi = q; else { bestBlob = blob; lo = q; }
    }

    const out = bestBlob ?? await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), targetMime, 0.7)
    );
    if (!out) return original;

    const newName =
      original.name.replace(/\.(png|jpg|jpeg|webp)$/i, "") +
      (targetMime === "image/webp" ? ".webp" : ".jpg");

    return new File([out], newName, { type: targetMime, lastModified: Date.now() });
  }

  function validateAndPreview(f?: File) {
    if (!f) return;
    const okTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!okTypes.includes(f.type)) {
      alert("File must be PNG, JPG, or WEBP.");
      return;
    }
    setFileName(f.name);
    setPreview(URL.createObjectURL(f));
    setWorkingFile(f);
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
  function onDragOver(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const picked = workingFile ?? (fileInputRef.current?.files?.[0] || null);
    if (!picked) { alert("Please choose an image."); return; }

    setLoading(true);
    try {
      const toSend = await compressIfNeeded(picked);

      fd.delete("file");
      fd.append("file", toSend, toSend.name);

      const res = await fetch("/api/submit", { method: "POST", body: fd });
      const text = await res.text();
      const data = JSON.parse(text || "{}");

      if (!res.ok || !data?.success) throw new Error(data?.error || "Upload failed");

      try {
        const raw = localStorage.getItem("fairblock_tokens");
        const map: Record<string, TokenRec> = raw ? JSON.parse(raw) : {};
        map[data.id] = {
          metaUrl: data.metaUrl,
          ownerTokenHash: data.ownerTokenHash,
          token: data.deleteToken,
        };
        localStorage.setItem("fairblock_tokens", JSON.stringify(map));
      } catch {}

      alert("Upload successful!");
      form.reset();
      setPreview(null);
      setFileName("");
      setWorkingFile(null);
      router.push("/gallery");
    } catch (err: any) {
      alert(err?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10">
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
          <input name="x" placeholder="Username X — e.g. @kanjuro"
            className="w-full px-4 py-3 rounded-xl bg-white/10 placeholder-white/60 focus:outline-none" />
          <input name="discord" placeholder="Username Discord — e.g. name#1234 or user ID"
            className="w-full px-4 py-3 rounded-xl bg-white/10 placeholder-white/60 focus:outline-none" />
        </div>

        <label
          className={`dropzone ${isDragging ? "dropzone--active" : ""} block`}
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          aria-label="Drop image here or click to choose" role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
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
          <div className="dropzone__sub">
            Format: PNG / JPG / WEBP — Max 8MB (auto compress if larger)
          </div>
        </label>

        {preview && (
          <div className="mt-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="preview" className="w-80 h-80 object-contain rounded-2xl bg-white/5" />
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
