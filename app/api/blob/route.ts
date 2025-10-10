// app/api/blob/route.ts
import { handleUpload } from "@vercel/blob/client";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing BLOB_READ_WRITE_TOKEN" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Beberapa versi @vercel/blob punya perbedaan tipe.
  // Opsi di bawah sudah kompatibel dan membatasi ukuran/tipe file.
  const res = await (handleUpload as unknown as (opts: any) => Promise<Response>)({
    request: req,
    token,
    onBeforeGenerateToken: async () => ({
      maximumSizeInBytes: 20 * 1024 * 1024, // hingga 20MB
      allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
    }),
    // field dummy agar lolos varian tipe yang mengharuskan "body"
    body: undefined,
  });

  return res as unknown as Response;
}
