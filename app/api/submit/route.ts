// app/api/submit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { randomBytes, randomUUID, createHash } from "crypto";

// ↪ kita import saat runtime supaya type cocok di Node
async function putBlob(name: string, body: Buffer | string, contentType: string, token: string) {
  const { put } = await import("@vercel/blob");
  return put(name, body, {
    access: "public",
    contentType,
    token,
  });
}

const MAX_SIZE = 8 * 1024 * 1024; // 8MB

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
    if (file.size > MAX_SIZE) return NextResponse.json({ success: false, error: "Max 8MB allowed." }, { status: 400 });

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN on server." }, { status: 500 });
    }

    const safeName = (file.name || "image").replace(/[^\w.-]+/g, "_");
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const deleteToken = randomBytes(24).toString("hex");
    const ownerTokenHash = createHash("sha256").update(deleteToken).digest("hex");

    // 1) upload image
    const imgBytes = Buffer.from(await file.arrayBuffer());
    const imagePath = `fairblock/images/${id}-${safeName}`;
    const img = await putBlob(imagePath, imgBytes, file.type, token);
    const imageUrl = img.url;

    // 2) upload meta JSON
    const meta = {
      id,
      title,
      x,
      discord,
      imageUrl,
      ownerTokenHash, // yg disimpan di Blob (bukan deleteToken asli)
      createdAt,
    };
    const metaPath = `fairblock/meta/${id}.json`;
    const metaBlob = await putBlob(metaPath, Buffer.from(JSON.stringify(meta)), "application/json", token);

    // 3) balikan data ke client (client simpan deleteToken & metaUrl di localStorage)
    return NextResponse.json({
      success: true,
      id,
      imageUrl,
      metaUrl: metaBlob.url,
      deleteToken,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Upload failed" }, { status: 500 });
  }
}
