import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Missing BLOB_READ_WRITE_TOKEN" },
      { status: 500 }
    );
  }

  return handleUpload(req, {
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    access: "public",
    endpoint: "fairblock/uploads",
    onBeforeGenerateToken: async () => {
      return {
        maximumSizeInBytes: 20 * 1024 * 1024, // batas 20MB
        contentType: ["image/png", "image/jpeg", "image/webp"],
      };
    },
  });
}
