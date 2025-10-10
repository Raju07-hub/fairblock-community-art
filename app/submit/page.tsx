"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

type TokenRec = {
  metaUrl?: string;
  ownerTokenHash?: string;
  token?: string;
};

export default function SubmitPage() {
  const router = useRouter();

  // ✅ Semua state harus di dalam komponen
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [workingFile, setWorkingFile] = useState<File | null>(null);

  // ...fungsi createImage, compressIfNeeded, dsb tetap sama...

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    // ✅ sekarang workingFile sudah dikenal
    const picked = workingFile ?? (fileInputRef.current?.files?.[0] || null);
    if (!picked) {
      alert("Please choose an image.");
      return;
    }

    setLoading(true);
    try {
      const toSend = picked;

      // Upload direct ke blob (dengan route signer)
      const { url: imageUrl } = await upload(toSend.name, toSend, {
        access: "public",
        handleUploadUrl: "/api/blob",
      });

      const meta = new FormData();
      meta.set("title", String(fd.get("title") || ""));
      meta.set("x", String(fd.get("x") || ""));
      meta.set("discord", String(fd.get("discord") || ""));
      meta.set("blobUrl", imageUrl);

      const res = await fetch("/api/submit", { method: "POST", body: meta });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || "Submit failed");

      alert("Upload successful!");
      router.push("/gallery");
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {/* ...isi form seperti sebelumnya... */}
    </form>
  );
}
