// ...imports sama seperti milikmu sekarang...
export default function SubmitPage() {
  // ...state & helper sama...

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const picked = workingFile ?? (fileInputRef.current?.files?.[0] || null);
    if (!picked) { alert("Please choose an image."); return; }

    setLoading(true);
    try {
      const toSend = await compressIfNeeded(picked);

      // 1) Upload langsung ke Vercel Blob via /api/blob (signer)
      const { url: imageUrl } = await upload(toSend.name || "artwork", toSend, {
        access: "public",
        handleUploadUrl: "/api/blob",
      });

      // 2) Kirim metadata + blobUrl ke server (FormData)
      const meta = new FormData();
      meta.set("title", String(fd.get("title") || ""));
      meta.set("x", String(fd.get("x") || ""));
      meta.set("discord", String(fd.get("discord") || ""));
      meta.set("blobUrl", imageUrl);

      const res = await fetch("/api/submit", { method: "POST", body: meta });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "Submit failed");

      // simpan credential delete
      try {
        const raw = localStorage.getItem("fairblock_tokens");
        const map: Record<string, TokenRec> = raw ? JSON.parse(raw) : {};
        map[data.id] = { metaUrl: data.metaUrl, ownerTokenHash: data.ownerTokenHash, token: data.deleteToken };
        localStorage.setItem("fairblock_tokens", JSON.stringify(map));
      } catch {}

      alert("Upload successful!");
      form.reset(); setPreview(null); setFileName(""); setWorkingFile(null);
      router.push("/gallery");
    } catch (err: any) {
      alert(err?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  // ...UI sama persis dengan punyamu...
}
