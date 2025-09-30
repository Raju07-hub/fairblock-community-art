export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { createHash } from "crypto";

type In = { metaUrl?: string; deleteToken?: string; ownerTokenHash?: string };

export async function DELETE(req: Request, _ctx: { params: Promise<{ id: string }> }) {
  try {
    const { metaUrl, deleteToken, ownerTokenHash }: In = await req.json().catch(() => ({}));
    if (!metaUrl) return NextResponse.json({ error: "Missing metaUrl" }, { status: 400 });

    // Ambil metadata
    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const meta = await metaRes.json();

    // Otorisasi:
    // 1) Admin (optional)
    const adminHeader = (req.headers.get("x-admin-key") || "").trim();
    const isAdmin = !!process.env.ADMIN_KEY && adminHeader === process.env.ADMIN_KEY;

    // 2) Pemilik: cocokkan hash(deleteToken) dengan ownerTokenHash di meta
    let isOwner = false;
    if (deleteToken) {
      const hash = createHash("sha256").update(deleteToken).digest("hex");
      isOwner = hash === meta.ownerTokenHash;
    }
    // (opsional) dukung variabel ownerTokenHash langsung
    if (ownerTokenHash && ownerTokenHash === meta.ownerTokenHash) isOwner = true;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Hapus image & meta
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Missing blob token" }, { status: 500 });
    }
    if (meta.imageUrl) await del(meta.imageUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {});
    await del(metaUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Delete failed" }, { status: 500 });
  }
}
