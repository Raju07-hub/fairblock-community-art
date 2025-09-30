// app/api/submit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { randomBytes, randomUUID, createHash } from "crypto";

type PutBody = Blob | Buffer | ReadableStream | File;

type Meta = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  url: string;              // public URL ke gambar
  createdAt: string;
  ownerTokenHash: string;   // sha256(deleteToken)
};

const MAX_SIZE = 8 * 1024 * 1024; // 8MB

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const x = String(form.get("x") || "").trim();
    const discord = String(form.get("discord") || "").trim();
    const file = form.get("file") as File | null;

    if (!title) return NextResponse.json({ success: false, error: "Title is required." }, { status: 400 });
    if (!file || typeof file === "string")
      return NextResponse.json({ success: false, error: "File is required." }, { status: 400 });
    if (!file.type.startsWith("image/"))
      return NextResponse.json({ success: false, error: "File must be an image." }, { status: 400 });
    if (file.size > MAX_SIZE)
      return NextResponse.json({ success: false, error: "Max 8MB allowed." }, { status: 400 });

    const safeName = file.name.replace(/[^\w.-]+/g, "_") || "image";
    const fileName = `${Date.now()}_${safeName}`;
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const deleteToken = randomBytes(24).toString("hex");

    // ===== Upload gambar ke Blob (jika token tersedia), fallback ke local public/uploads saat dev =====
    let publicUrl = "";
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const body: PutBody = Buffer.from(await file.arrayBuffer());
      const blob = await put(`fairblock/${fileName}`, body, {
        access: "public",
        contentType: file.type,
        token: process.env.BLOB_READ_WRITE_TOKEN!,
      });
      publicUrl = blob.url;
    } else {
      // local (untuk dev)
      const publicDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(publicDir, { recursive: true });
      const dest = path.join(publicDir, fileName);
      await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));
      publicUrl = `/uploads/${fileName}`;
    }

    // ===== Buat META JSON di Blob (supaya Gallery & Delete tak pakai file JSON lokal) =====
    let metaUrl = "";
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const meta: Meta = {
        id,
        title,
        x,
        discord,
        url: publicUrl,
        createdAt,
        ownerTokenHash: createHash("sha256").update(deleteToken).digest("hex"),
      };
      const metaBlob = await put(`fairblock/meta/${id}.json`, Buffer.from(JSON.stringify(meta)), {
        access: "public",
        contentType: "application/json",
        token: process.env.BLOB_READ_WRITE_TOKEN!,
      });
      metaUrl = metaBlob.url;
    }

    return NextResponse.json({
      success: true,
      id,
      url: publicUrl,
      deleteToken,
      metaUrl, // <- dipakai client utk simpan mapping & oleh /api/gallery DELETE
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Upload failed" }, { status: 500 });
  }
}
