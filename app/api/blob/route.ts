import { NextResponse } from "next/server";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST() {
  const rw = process.env.BLOB_READ_WRITE_TOKEN;
  if (!rw) {
    return NextResponse.json(
      { error: "Missing BLOB_READ_WRITE_TOKEN" },
      { status: 500 }
    );
  }

  // Gunakan nama baru sesuai versi library
  const token = await generateClientTokenFromReadWriteToken({
    token: rw,
    allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
    maximumSizeInBytes: 20 * 1024 * 1024, // max 20MB
  });

  return NextResponse.json(token);
}
