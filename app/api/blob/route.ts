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

  // ✅ field `pathname` wajib sekarang (boleh apa saja, folder upload)
  const token = await generateClientTokenFromReadWriteToken({
    token: rw,
    pathname: "fairblock/uploads", // direktori dasar untuk semua upload
    allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
    maximumSizeInBytes: 20 * 1024 * 1024, // max 20MB
  });

  return NextResponse.json(token);
}
