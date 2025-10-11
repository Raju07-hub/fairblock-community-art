export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createHash, randomBytes, randomUUID } from "crypto";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function extFromMime(m: string) {
  if (m === "image/png") return "png";
  if (m === "image/jpeg") return "jpg";
  if (m === "image/webp") return "webp";
  return "bin";
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const x = String(form.get("x") || "").trim();
    const discord = String(form.get("discord") || "").trim();
    const postUrlRaw = String(form.get("postUrl") || "").trim(); // NEW
    const file = form.get("file") as File | null;

    if (!title) {
      return NextResponse.json({ success: false, error: "Title is required." }, { status: 400 });
    }
    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "File is required." }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
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

    const id = randomUUID();
    const deleteToken = randomBytes(24).toString("hex");
    const ownerTokenHash = createHash("sha256").update(deleteToken).digest("hex");
    const createdAt = new Date().toISOString();
    const ext = extFromMime(file.type);

    const { put } = await import("@vercel/blob");
    const bytes = Buffer.from(await file.arrayBuffer());

    // 1) upload image
    const imageKey = `fairblock/img/${id}.${ext}`;
    const image = await put(imageKey, bytes, {
      access: "public",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // 2) save metadata
    const metaKey = `fairblock/meta/${id}.json`;

    const postUrl = postUrlRaw && isHttpUrl(postUrlRaw) ? postUrlRaw : ""; // sanitize

    const meta = {
      id,
      title,
      x,
      discord,
      imageUrl: image.url, // use "imageUrl" for consistency (gallery falls back to meta.url)
      createdAt,
      ownerTokenHash,
      // keep legacy for old clients (optional):
      url: image.url,
      // NEW:
      postUrl,
    };

    const metaBlob = await put(metaKey, Buffer.from(JSON.stringify(meta, null, 2)), {
      access: "public",
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      success: true,
      id,
      url: image.url,
      metaUrl: metaBlob.url,
      ownerTokenHash,
      deleteToken, // return for client to store
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
