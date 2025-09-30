// app/api/gallery/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    // token dari header
    const bearer = req.headers.get("authorization") || "";
    const tokenHeader =
      req.headers.get("x-delete-token") ||
      (bearer.startsWith("Bearer ") ? bearer.slice(7) : "");

    // admin override (opsional)
    const adminHeader = req.headers.get("x-admin-key") || "";
    const isAdmin =
      !!process.env.ADMIN_KEY && adminHeader === process.env.ADMIN_KEY;

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ success:false, error:"Missing BLOB_READ_WRITE_TOKEN" }, { status:500 });
    }

    // body harus berisi metaUrl
    const { metaUrl } = await req.json().catch(() => ({}));
    if (!metaUrl) {
      return NextResponse.json({ success:false, error:"Missing metaUrl" }, { status:400 });
    }

    // fetch meta (PUBLIC), verifikasi id
    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) {
      return NextResponse.json({ success:false, error:"Not found" }, { status:404 });
    }
    const meta = await metaRes.json();
    if (meta?.id !== id) {
      return NextResponse.json({ success:false, error:"ID mismatch" }, { status:400 });
    }

    // validasi owner (sederhana): token harus ada.
    // (opsional lebih kuat: simpan ownerTokenHash di meta & cocokkan hash(tokenHeader))
    const isOwner = !!tokenHeader;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ success:false, error:"Unauthorized" }, { status:403 });
    }

    // hapus gambar & meta di Blob
    const { del } = await import("@vercel/blob");
    await Promise.allSettled([
      del(meta.url, { token: process.env.BLOB_READ_WRITE_TOKEN }),
      del(metaUrl,  { token: process.env.BLOB_READ_WRITE_TOKEN }),
    ]);

    return NextResponse.json({ success:true, by: isAdmin ? "admin" : "owner" });
  } catch (e: any) {
    return NextResponse.json({ success:false, error: e?.message || "Delete failed" }, { status:500 });
  }
}
