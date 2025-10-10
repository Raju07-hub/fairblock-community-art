// app/api/blob/route.ts
import { handleUpload } from "@vercel/blob/client";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response(
      JSON.stringify({ error: "Missing BLOB_READ_WRITE_TOKEN" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  // API expects an object with { request, token, ... }
  const res = await handleUpload({
    request: req,
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    onBeforeGenerateToken: async () => ({
      maximumSizeInBytes: 20 * 1024 * 1024,                 // allow up to 20 MB
      allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
    }),
    // onUploadCompleted is optional; metadata handled by /api/submit-meta
    // onUploadCompleted: async () => {},
  });

  return res as unknown as Response;
}
