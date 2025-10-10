// app/submit/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

type TokenRec = {
  metaUrl?: string;
  ownerTokenHash?: string;
  token?: string;
};

const MAX_BYTES = 8 * 1024 * 1024;        // 8 MB
const TARGET_BYTES = 7.9 * 1024 * 1024;   // target sedikit di bawah 8MB
const MAX_SIDE = 4096;                    // batasi sisi terpanjang jika gambar sangat besar

export default function SubmitPage() {
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [workingFile, setWorkingFile] = useState<File | null>(null);

  // ---------- Image utils ----------
  function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async function compressIfNeeded(original: File): Promise<File> {
    if (!/^image\/(png|jpeg|webp)$/i.test(original.type)) {
      // format tidak didukung → tetap kirim apa adanya
      return original;
    }
    if (original.size <= MAX_BYTES) return original;

    // pakai webp utk rasio bagus, kecuali asalnya jpeg (boleh stay jpeg)
    const targetMime = original.type === "image/jpeg" ? "image/jpeg" : "image/webp";

    // load ke img/canvas
    const blobUrl = URL.createObjectURL(original);
    const img = await createImage(blobUrl);
    URL.revokeObjectURL(blobUrl);

    // hitung dimension baru (jika perlu perkecil)
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

    // binary search quality 0.95 .. 0.5 untuk capai TARGET_BYTES
    let lo = 0.5, hi = 0.95, bestBlob: Blob | null = null;
    for (let i = 0; i < 8; i++) {
      const q = (lo + hi) / 2;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), targetMime, q)
      );
      if (!blob) break;

      if (blob.size > TARGET_BYTES) {
        // masih kegedean → turunkan quality
        hi = q;
      } else {
        bestBlob = blob; // acceptable, coba naikkan dikit biar tidak terlalu burik
        lo = q;
      }
    }

    const out = bestBlob ?? (await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), targetMime, 0.7)
    ));

    if (!out) return original;

    // pastikan nama & type
    const newName =
      original.name.replace(/\.(png|jpg|jpeg|webp)$/i, "") +
      (targetMime === "image/webp" ? ".webp" : ".jpg");

    return new File([out], newName, { type: targetMime, lastModified: Date.now() });
  }

  // ---------- UI helpers ----------
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

  // ---------- Submit (direct-to-blob) ----------
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const picked = workingFile ?? (fileInputRef.current?.files?.[0] || null);
    if (!picked) {
      alert("Please choose an image.");
      return;
    }

    setLoading(true);
    try {
      // 1) Kompres jika perlu
      const toSend = await compressIfNeeded(picked);

      // 2) Upload langsung ke Vercel Blob (tanpa melewati body API)
      const { url: imageUrl } = await upload(toSend.name || "artwork", toSend, {
        access: "public",
        handleUploadUrl: "/api/blob", // route signer
      });

      // 3) Kirim METADATA (tanpa file) ke server
      const title = String(fd.get("title") || "").trim();
      const x = String(fd.get("x") || "").trim();
      const discord = String(fd.get("discord") || "").trim();

      const res = await fetch("/api/submit-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, x, discord, imageUrl }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "Submit failed");

      // 4) Simpan credential delete (sama seperti sebelumnya)
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

  // ---------- UI ----------
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
          <div className="dropzone__sub">
            Format: PNG / JPG / WEBP — Max 8MB (auto compress if larger)
          </div>
        </label>

        {preview && (
          <div className="mt-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
