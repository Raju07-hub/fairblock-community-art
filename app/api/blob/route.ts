import { handleUpload } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });
  }

  try {
    // handleUpload dari @vercel/blob otomatis generate client token
    const response = await handleUpload({
      request: req,
      token,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
        maximumSizeInBytes: 20 * 1024 * 1024, // up to 20 MB
      }),
    });

    // hasil handleUpload langsung response JSON ke client
    return response as unknown as Response;
  } catch (err: any) {
    console.error("Blob upload error:", err);
    return NextResponse.json({ error: err?.message || "Upload failed" }, { status: 500 });
  }
}
