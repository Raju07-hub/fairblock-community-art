// app/api/blob/route.ts
import { handleUpload } from "@vercel/blob/client";

export const runtime = "edge";            // ← run this on the Edge for the proper Web Response type
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response(
      JSON.stringify({ error: "Missing BLOB_READ_WRITE_TOKEN" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  // handleUpload returns a Web Response in runtime 'edge', but TS types can be too strict in Next 15.
  // We cast to Response to satisfy Next's RouteHandlerConfig.
  const res = await handleUpload(req, {
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    access: "public",
    endpoint: "fairblock/uploads",
    onBeforeGenerateToken: async () => ({
      maximumSizeInBytes: 20 * 1024 * 1024,  // allow up to 20MB
      contentType: ["image/png", "image/jpeg", "image/webp"],
    }),
    // onUploadCompleted is optional; metadata is handled by /api/submit-meta
  });

  return res as unknown as Response;
}
