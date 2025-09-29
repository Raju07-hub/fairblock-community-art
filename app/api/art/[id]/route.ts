export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  _params: { params: { id: string } }
) {
  try {
    const { ownerTokenHash, metaUrl } = await req.json().catch(() => ({}));
    if (!ownerTokenHash || !metaUrl) {
      return NextResponse.json(
        { error: "Missing ownerTokenHash or metaUrl" },
        { status: 400 }
      );
    }

    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const meta = await metaRes.json();
    if (meta.ownerTokenHash !== ownerTokenHash) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Hapus gambar dan metadata dari Blob
    await del(meta.imageUrl);
    await del(metaUrl);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Delete failed" },
      { status: 500 }
    );
  }
}
