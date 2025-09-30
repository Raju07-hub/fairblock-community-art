// app/api/submit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomBytes, randomUUID } from "crypto";

type GalleryItem = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  url: string;        // public URL image
  createdAt: string;
  deleteToken: string; // hanya disimpan di meta, JANGAN dikirim ke client pada GET
};

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const IMAGES_PREFIX = "gallery/images";
const META_PREFIX   = "gallery/meta";

export async function POST(req: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const title   = String(form.get("title") || "").trim();
    const x       = String(form.get("x") || "").trim();
    const discord = String(form.get("discord") || "").trim();
    const file    = form.get("file") as File | null;

    if (!title) return NextResponse.json({ success: false, error: "Title is required." }, { status: 400 });
    if (!file || typeof file === "string") return NextResponse.json({ success: false, error: "File is required." }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ success: false, error: "File must be an image." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ success: false, error: "Max 8MB allowed." }, { status: 400 });

    const safeName = (file.name || "image").replace(/[^\w.-]+/g, "_");
    const id           = randomUUID();
    const createdAt    = new Date().toISOString();
    const deleteToken  = randomBytes(24).toString("hex");

    // 1) Upload image
    const imageKey = `${IMAGES_PREFIX}/${id}_${safeName}`;
    const imageBytes = Buffer.from(await file.arrayBuffer());
    const imageBlob = await put(imageKey, imageBytes, {
      access: "public",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // 2) Simpan metadata 1-file-per-item (mudah di-list & dihapus)
    const meta: GalleryItem = {
      id, title, x, discord,
      url: imageBlob.url,
      createdAt,
      deleteToken,
    };
    const metaKey = `${META_PREFIX}/${id}.json`;
    await put(metaKey, JSON.stringify(meta, null, 2), {
      access: "public",                 // boleh public; GET nanti tidak akan kirim deleteToken
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // 3) Balikkan info ke client (jangan bocorkan token di GET — ini hanya untuk localStorage)
    return NextResponse.json({ success: true, id, url: imageBlob.url, deleteToken });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Upload failed" }, { status: 500 });
  }
}

// const map: Record<string, string> = raw ? JSON.parse(raw) : {};
// map[data.id] = data.deleteToken;

type TokenMap = Record<string, { token: string; metaUrl: string }>;
const raw = localStorage.getItem("fairblock_tokens");
const map: TokenMap = raw ? JSON.parse(raw) : {};
map[data.id] = { token: data.deleteToken, metaUrl: data.metaUrl };
localStorage.setItem("fairblock_tokens", JSON.stringify(map));