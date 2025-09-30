// app/api/submit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomBytes, randomUUID, createHash } from "crypto";

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
    const fileName = `${Date.now()}_${safeName}`;
    const createdAt = new Date().toISOString();
    const id = randomUUID();

    // Owner delete token (client-only)
    const deleteToken = randomBytes(24).toString("hex");
    const ownerTokenHash = createHash("sha256").update(deleteToken).digest("hex");

    // Upload image
    const bytes = Buffer.from(await file.arrayBuffer());
    const imageBlob = await put(`fairblock/images/${fileName}`, bytes, {
      access: "public",
      contentType: file.type,
      token,
    });

    // Write meta json beside it
    const meta = {
      id,
      title,
      x,
      discord,
      imageUrl: imageBlob.url,
      createdAt,
      ownerTokenHash,
      version: 1,
    };

    const metaBlob = await put(`fairblock/meta/${id}.json`, JSON.stringify(meta), {
      access: "public",
      contentType: "application/json",
      token,
    });

    return NextResponse.json({
      success: true,
      id,
      url: imageBlob.url,
      deleteToken,          // keep only on the client
      metaUrl: metaBlob.url // handy for delete-by-meta later
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Upload failed" }, { status: 500 });
  }
}
