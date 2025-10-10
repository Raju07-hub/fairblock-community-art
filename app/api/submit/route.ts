export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createHash, randomBytes, randomUUID } from "crypto";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB (hanya untuk jalur upload via server)
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function extFromMime(m: string) {
  if (m === "image/png") return "png";
  if (m === "image/jpeg") return "jpg";
  if (m === "image/webp") return "webp";
  return "bin";
}

export async function POST(req: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });
    }

    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const x = String(form.get("x") || "").trim();
    const discord = String(form.get("discord") || "").trim();

    // NEW: dukung jalur direct-to-blob
    const blobUrl = String(form.get("blobUrl") || "");
    const file = form.get("file") as File | null;

    if (!title) {
      return NextResponse.json({ success: false, error: "Title is required." }, { status: 400 });
    }

    let imageUrl = "";

    if (blobUrl) {
      // gambar sudah ter-upload ke Vercel Blob dari client
      imageUrl = blobUrl;
    } else {
      // === Jalur lama: upload file lewat server (tetap dipertahankan untuk file kecil) ===
      if (!file || typeof file === "string") {
        return NextResponse.json({ success: false, error: "File is required." }, { status: 400 });
      }
      if (!ALLOWED.has(file.type)) {
        return NextResponse.json({ success: false, error: "File must be PNG, JPG, or WEBP." }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ success: false, error: "Maximum file size is 8MB." }, { status: 400 });
      }

      const idForImg = randomUUID();
      const ext = extFromMime(file.type);
      const bytes = Buffer.from(await file.arrayBuffer());

      const { put } = await import("@vercel/blob");
      const image = await put(`fairblock/img/${idForImg}.${ext}`, bytes, {
        access: "public",
        contentType: file.type,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      imageUrl = image.url;
    }

    // Simpan metadata seperti biasa
    const id = randomUUID();
    const deleteToken = randomBytes(24).toString("hex");
    const ownerTokenHash = createHash("sha256").update(deleteToken).digest("hex");
    const createdAt = new Date().toISOString();

    const { put } = await import("@vercel/blob");
    const metaKey = `fairblock/meta/${id}.json`;
    const meta = { id, title, x, discord, url: imageUrl, createdAt, ownerTokenHash };

    const metaBlob = await put(metaKey, Buffer.from(JSON.stringify(meta)), {
      access: "public",
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      success: true,
      id,
      url: imageUrl,
      metaUrl: metaBlob.url,
      ownerTokenHash,
      deleteToken,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Upload failed" }, { status: 500 });
  }
}
