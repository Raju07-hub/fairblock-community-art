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

  // Versi API: handleUpload({ request, token, ...callbacks })
  const res = await handleUpload({
    request: req,
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    // validasi sebelum client dapat token upload
    onBeforeGenerateToken: async () => ({
      maximumSizeInBytes: 20 * 1024 * 1024, // izinkan sampai 20MB
      allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
    }),
    // opsional: dipanggil saat upload selesai (metadata tetap di /api/submit-meta)
    onUploadCompleted: async () => {
      // no-op
    },
    // public agar bisa dipakai langsung di Gallery
    // catatan: di beberapa versi, access diset di client; kalau perlu bisa hilangkan baris ini
    access: "public" as const,
  });

  return res as unknown as Response;
}
