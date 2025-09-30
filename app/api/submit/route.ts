export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomBytes, randomUUID, createHash } from "crypto";

type Out = {
  success: boolean;
  id?: string;
  url?: string;
  metaUrl?: string;
  deleteToken?: string;
  error?: string;
};

const MAX_SIZE = 8 * 1024 * 1024; // 8MB

export async function POST(req: Request): Promise<NextResponse<Out>> {
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

    // === Always use Vercel Blob in prod ===
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const deleteToken = randomBytes(24).toString("hex");
    const ownerTokenHash = createHash("sha256").update(deleteToken).digest("hex");

    // Upload image
    const imgBytes = Buffer.from(await file.arrayBuffer());
    const imgNameSafe = (file.name || "image").replace(/[^\w.-]+/g, "_");
    const imgKey = `fairblock/images/${id}_${imgNameSafe}`;
    const img = await put(imgKey, imgBytes, {
      access: "public",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Upload metadata (berisi hash token, bukan token aslinya)
    const metaKey = `fairblock/meta/${id}.json`;
    const metaBody = JSON.stringify(
      { id, title, x, discord, imageUrl: img.url, createdAt, ownerTokenHash },
      null,
      2
    );
    const meta = await put(metaKey, metaBody, {
      access: "public",
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      success: true,
      id,
      url: img.url,
      metaUrl: meta.url,
      deleteToken, // client simpan lokal buat bukti kepemilikan
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Upload failed" }, { status: 500 });
  }
}
