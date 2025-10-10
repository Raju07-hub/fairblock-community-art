export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createHash, randomBytes, randomUUID } from "crypto";
import { put } from "@vercel/blob";

export async function POST(req: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    const { title, x, discord, imageUrl } = await req.json();
    if (!title) return NextResponse.json({ success: false, error: "Title required" }, { status: 400 });
    if (!imageUrl) return NextResponse.json({ success: false, error: "imageUrl required" }, { status: 400 });

    const id = randomUUID();
    const deleteToken = randomBytes(24).toString("hex");
    const ownerTokenHash = createHash("sha256").update(deleteToken).digest("hex");
    const createdAt = new Date().toISOString();

    const meta = { id, title, x, discord, url: imageUrl, createdAt, ownerTokenHash };

    const metaBlob = await put(`fairblock/meta/${id}.json`, Buffer.from(JSON.stringify(meta)), {
      access: "public",
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      success: true,
      id,
      url: imageUrl,
      metaUrl: metaBlob.url,
      ownerTokenHash,
      deleteToken,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Submit failed" },
      { status: 500 }
    );
  }
}
