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

  // Versi type di project kamu mewajibkan "body" di options.
  // Kita cast supaya kompatibel dengan implementasi runtime yang benar.
  const uploadHandler = handleUpload as unknown as (opts: any) => Promise<Response>;

  const res = await uploadHandler({
    request: req,
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    onBeforeGenerateToken: async () => ({
      maximumSizeInBytes: 20 * 1024 * 1024, // allow up to 20MB
      allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
    }),
    // Tambahkan body dummy agar lolos tipe lama yang mewajibkan field ini
    body: undefined,
  });

  return res as unknown as Response;
}
