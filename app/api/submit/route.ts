// app/api/submit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { randomBytes, randomUUID, createHash } from "crypto";

type Meta = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  imageUrl: string;
  createdAt: string;
  ownerTokenHash: string; // hash dari ownerToken (bukan raw token)
  // bidang tambahan untuk kompatibilitas/masa depan
  version: 2;
};

const MAX_SIZE = 8 * 1024 * 1024; // 8MB

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const x = String(form.get("x") || "").trim();
    const discord = String(form.get("discord") || "").trim();
    const file = form.get("file") as File | null;

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required." },
        { status: 400 }
      );
    }
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "File is required." },
        { status: 400 }
      );
    }
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      return NextResponse.json(
        { success: false, error: "File must be PNG, JPG, or WEBP." },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "Maximum file size is 8MB." },
        { status: 400 }
      );
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing BLOB_READ_WRITE_TOKEN." },
        { status: 500 }
      );
    }

    // --- siapkan identitas & nama file ---
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const safeName = (file.name || "image")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+/, "");
    const ext =
      (/\.(png|jpe?g|webp)$/i.exec(safeName)?.[0] as string | undefined) ||
      (file.type === "image/png"
        ? ".png"
        : file.type === "image/webp"
        ? ".webp"
        : ".jpg");

    const imageKey = `fairblock/images/${id}${ext}`;
    const metaKey = `fairblock/meta/${id}.json`;

    // --- unggah gambar ---
    const { put } = await import("@vercel/blob");
    const imageBytes = Buffer.from(await file.arrayBuffer());
    const image = await put(imageKey, imageBytes, {
      access: "public",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    const imageUrl = image.url;

    // --- buat owner token (hanya hash yg disimpan di meta) ---
    // Catatan: yang DIKIRIM ke client adalah ownerTokenHash saja (aman disimpan),
    // sedangkan token raw dikelola di sisi client (localStorage) bila perlu.
    const ownerTokenRaw = randomBytes(24).toString("hex");
    const ownerTokenHash = createHash("sha256")
      .update(ownerTokenRaw)
      .digest("hex");

    // --- unggah metadata JSON ---
    const meta: Meta = {
      id,
      title,
      x,
      discord,
      imageUrl,
      createdAt,
      ownerTokenHash,
      version: 2,
    };
    const metaBlob = await put(metaKey, Buffer.from(JSON.stringify(meta)), {
      access: "public",
      contentType: "application/json; charset=utf-8",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    const metaUrl = metaBlob.url;

    // --- response ke client ---
    // Untuk UI baru: gunakan metaUrl + ownerTokenHash.
    // Field deleteToken disertakan kosong hanya agar aman bila ada kode lama.
    return NextResponse.json({
      success: true,
      id,
      url: imageUrl,
      metaUrl,
      ownerTokenHash,
      deleteToken: "", // legacy fallback (tidak dipakai pada model baru)
      // Opsi: kirim juga ownerTokenRaw bila kamu mau simpan yang raw di client (TIDAK disarankan).
      // ownerToken: ownerTokenRaw,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
