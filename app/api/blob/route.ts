// app/api/blob/route.ts
import { handleUpload } from "@vercel/blob/client";

export const runtime = "edge";            // gunakan Web Response (cocok dengan handleUpload)
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response(
      JSON.stringify({ error: "Missing BLOB_READ_WRITE_TOKEN" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  // Versi paket kamu menerima SATU argumen saja.
  // Default behavior sudah cukup untuk direct-to-blob.
  const res = await handleUpload(req);

  // Cast agar lolos tipe Next 15
  return res as unknown as Response;
}
