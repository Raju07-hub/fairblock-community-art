// app/api/submit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { randomBytes, randomUUID, createHash } from "crypto";

type PutFn = (key: string, body: any, opts: any) => Promise<{ url: string; pathname?: string; key?: string }>;

function sha256Hex(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const title   = String(form.get("title")   || "").trim();
    const x       = String(form.get("x")       || "").trim();
    const discord = String(form.get("discord") || "").trim();
    const file    = form.get("file") as File | null;

    if (!title) return NextResponse.json({ success:false, error:"Title is required." },{status:400});
    if (!file || typeof file === "string") return NextResponse.json({ success:false, error:"File is required." },{status:400});
    if (!file.type.startsWith("image/")) return NextResponse.json({ success:false, error:"File must be an image." },{status:400});
    if (file.size > 8*1024*1024) return NextResponse.json({ success:false, error:"Max 8MB allowed." },{status:400});

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ success:false, error:"Missing BLOB_READ_WRITE_TOKEN" }, { status:500 });
    }

    const { put } = await import("@vercel/blob") as { put: PutFn };

    const safe = file.name.replace(/[^\w.-]+/g,"_") || "image";
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const deleteToken = randomBytes(24).toString("hex");
    const ownerTokenHash = sha256Hex(deleteToken);

    // 1) upload image
    const imageBytes = Buffer.from(await file.arrayBuffer());
    const imageKey = `fairblock/${id}_${safe}`;
    const img = await put(imageKey, imageBytes, {
      access: "public",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    const imageUrl = img.url;

    // 2) upload metadata
    const metaKey = `fairblock/meta/${id}.json`;
    const metaObj = {
      id, title, x, discord,
      url: imageUrl,
      createdAt,
      ownerTokenHash,
      version: 1,
    };
    const meta = await put(metaKey, JSON.stringify(metaObj), {
      access: "public",
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      success: true,
      id,
      url: imageUrl,
      metaUrl: meta.url,
      deleteToken,          // disimpan di localStorage klien
    });
  } catch (e: any) {
    return NextResponse.json({ success:false, error: e?.message || "Upload failed" }, { status:500 });
  }
}
