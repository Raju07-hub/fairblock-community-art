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

function normHandle(v: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  const noAt = s.replace(/^@/, "");
  return `@${noAt}`;
}

function normPostUrl(u: string) {
  const s = String(u || "").trim();
  if (!s) return "";
  // biarkan apa adanya; validasi ringan
  if (!/^https?:\/\//i.test(s)) return "";
  return s;
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
    const x = normHandle(String(form.get("x") || ""));
    const discord = normHandle(String(form.get("discord") || ""));
    const postUrl = normPostUrl(String(form.get("postUrl") || "")); // ← NEW
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

    // 2) save meta
    const metaKey = `fairblock/meta/${id}.json`;
    const meta = {
      id,
      title,
      x,         // "@user"
      discord,   // "@discordUser"
      postUrl,   // ← NEW
      imageUrl: image.url,    // gunakan imageUrl (baru)
      createdAt,
      ownerTokenHash,
    };

    const metaBlob = await put(metaKey, Buffer.from(JSON.stringify(meta)), {
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
      deleteToken,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
