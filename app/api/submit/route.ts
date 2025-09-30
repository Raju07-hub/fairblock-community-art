// app/api/submit/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

type GalleryItem = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  imageUrl: string;
  createdAt: string;
  ownerTokenHash: string; // hash dari deleteToken (agar aman)
};

const META_KEY = "gallery/metadata.json";

async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function loadMeta(): Promise<GalleryItem[]> {
  const l = await list({ prefix: META_KEY });
  const metaBlob = l.blobs.find(b => b.pathname === META_KEY);
  if (!metaBlob) return [];
  const res = await fetch(metaBlob.url, { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json().catch(() => [])) as GalleryItem[];
}

async function saveMeta(items: GalleryItem[]) {
  await put(META_KEY, JSON.stringify(items, null, 2), {
    access: "public",
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const x = String(form.get("x") || "").trim();
    const discord = String(form.get("discord") || "").trim();
    const file = form.get("file") as File | null;

    if (!title) return NextResponse.json({ success: false, error: "Title is required." }, { status: 400 });
    if (!file || typeof file === "string") return NextResponse.json({ success: false, error: "File is required." }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ success: false, error: "File must be an image." }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ success: false, error: "Max 8MB allowed." }, { status: 400 });

    // upload gambar ke Blob (pakai stream bawaan File)
    const safe = (file.name || "image").replace(/[^\w.-]+/g, "_");
    const imageKey = `gallery/${Date.now()}_${safe}`;
    const uploaded = await put(imageKey, file.stream(), {
      access: "public",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // token owner (plaintext untuk client; disimpan versi hash di metadata)
    const deleteToken = crypto.randomUUID();
    const ownerTokenHash = await sha256Hex(deleteToken);

    const item: GalleryItem = {
      id: crypto.randomUUID(),
      title,
      x,
      discord,
      imageUrl: uploaded.url,
      createdAt: new Date().toISOString(),
      ownerTokenHash,
    };

    const items = await loadMeta();
    items.unshift(item);
    await saveMeta(items);

    return NextResponse.json({
      success: true,
      id: item.id,
      imageUrl: item.imageUrl,
      deleteToken, // simpan di localStorage client
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Upload failed" }, { status: 500 });
  }
}
