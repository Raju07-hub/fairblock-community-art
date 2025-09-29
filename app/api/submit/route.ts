// app/api/submit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
// ✅ PAKAI Node Crypto (bukan globalThis.crypto)
import { randomUUID, randomBytes } from "node:crypto";

type GalleryItem = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  url: string;
  createdAt: string;
  deleteToken: string;
  storage?: {
    kind: "local" | "blob";
    path?: string;
    blobKey?: string;
  };
};

const MAX_SIZE = 8 * 1024 * 1024; // 8MB

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const x = String(form.get("x") || "").trim();
    const discord = String(form.get("discord") || "").trim();
    const file = form.get("file") as File | null;

    if (!title)
      return NextResponse.json({ success: false, error: "Title wajib diisi." }, { status: 400 });
    if (!file || typeof file === "string")
      return NextResponse.json({ success: false, error: "File wajib diunggah." }, { status: 400 });
    if (!file.type.startsWith("image/"))
      return NextResponse.json({ success: false, error: "File harus gambar." }, { status: 400 });
    if (file.size > MAX_SIZE)
      return NextResponse.json({ success: false, error: "Maksimal 8MB." }, { status: 400 });

    const safeName = file.name.replace(/[^\w.-]+/g, "_") || "image";
    const fileName = `${Date.now()}_${safeName}`;
    const createdAt = new Date().toISOString();

    // ✅ gunakan Node Crypto
    const id = randomUUID();
    const deleteToken = randomBytes(24).toString("hex");

    let publicUrl = "";
    let storageInfo: GalleryItem["storage"] = { kind: "local" };

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // lazy import agar tidak membebani dev env tanpa token
      const { put } = await import("@vercel/blob");
      const arrayBuf = await file.arrayBuffer();
      const blob = await put(`fairblock/${fileName}`, new Uint8Array(arrayBuf), {
        access: "public",
        contentType: file.type,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      publicUrl = blob.url;
      storageInfo = { kind: "blob", blobKey: (blob as any).pathname || `fairblock/${fileName}` };
    } else {
      const publicDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(publicDir, { recursive: true });
      const dest = path.join(publicDir, fileName);
      await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));
      publicUrl = `/uploads/${fileName}`;
      storageInfo = { kind: "local", path: dest };
    }

    // simpan metadata
    const dataDir = path.join(process.cwd(), "data");
    const dataFile = path.join(dataDir, "gallery.json");
    await fs.mkdir(dataDir, { recursive: true });
    let items: GalleryItem[] = [];
    try {
      items = JSON.parse(await fs.readFile(dataFile, "utf-8"));
    } catch {}
    const item: GalleryItem = {
      id,
      title,
      x,
      discord,
      url: publicUrl,
      createdAt,
      deleteToken,
      storage: storageInfo,
    };
    items.unshift(item);
    await fs.writeFile(dataFile, JSON.stringify(items, null, 2), "utf-8");

    return NextResponse.json({ success: true, id, url: publicUrl, deleteToken });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Upload gagal" },
      { status: 500 }
    );
  }
}
