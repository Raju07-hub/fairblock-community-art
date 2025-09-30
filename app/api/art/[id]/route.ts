// app/api/art/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { createHash } from "crypto";

/**
 * DELETE /api/art/:id
 * Body JSON: { token: string, metaUrl: string }
 * - token   : delete token yang kamu simpan di localStorage saat submit
 * - metaUrl : URL JSON meta yang disimpan di Blob saat upload
 *
 * Server akan:
 * 1) Fetch metaUrl
 * 2) Bandingkan sha256(token) dengan meta.ownerTokenHash
 * 3) Jika cocok, hapus file gambar (meta.imageUrl) dan file meta (metaUrl)
 */
export async function DELETE(
  req: NextRequest,
  _ctx: { params: Promise<{ id: string }> } // Next.js 15: params adalah Promise (tidak dipakai di sini)
) {
  try {
    const { token, metaUrl } = await req.json().catch(() => ({}));
    if (!token || !metaUrl) {
      return NextResponse.json(
        { error: "Missing token or metaUrl" },
        { status: 400 }
      );
    }

    // Ambil meta dari Blob
    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const meta: any = await metaRes.json();

    // Verifikasi kepemilikan: sha256(token) === meta.ownerTokenHash
    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (meta.ownerTokenHash !== tokenHash) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Hapus file gambar + file meta dari Blob
    const RW = process.env.BLOB_READ_WRITE_TOKEN;
    if (!RW) {
      return NextResponse.json(
        { error: "Server misconfigured: missing BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    const tasks: Promise<any>[] = [];
    if (meta.imageUrl) tasks.push(del(meta.imageUrl, { token: RW }));
    tasks.push(del(metaUrl, { token: RW }));
    await Promise.allSettled(tasks);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Delete failed" },
      { status: 500 }
    );
  }
}
