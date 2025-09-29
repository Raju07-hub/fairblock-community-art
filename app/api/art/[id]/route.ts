export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function DELETE(req: Request) {
  try {
    const { ownerTokenHash, metaUrl } = await req.json().catch(() => ({}));
    if (!ownerTokenHash || !metaUrl) {
      return NextResponse.json(
        { error: "Missing ownerTokenHash or metaUrl" },
        { status: 400 }
      );
    }

    // Ambil metadata dari Blob (tidak cache)
    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const meta = await metaRes.json();
    if (meta.ownerTokenHash !== ownerTokenHash) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Hapus gambar dan metadata dari Vercel Blob
    await del(meta.imageUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
    await del(metaUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
        { error: err?.message || "Delete failed" },
        { status: 500 }
    );
  }
}
