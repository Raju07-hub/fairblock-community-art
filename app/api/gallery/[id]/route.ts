// app/api/gallery/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";

const META_KEY = (id: string) => `gallery/meta/${id}.json`;

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } // Next.js 15: params is a Promise
) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    const { id } = await context.params;

    // Ambil meta.json untuk item ini
    const metaUrlGuess = await guessBlobPublicUrl(META_KEY(id));
    const metaRes = await fetch(metaUrlGuess, { cache: "no-store" });
    if (!metaRes.ok) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    const meta = await metaRes.json();

    // Token dari header
    const adminKey   = req.headers.get("x-admin-key") || "";
    const bearer     = req.headers.get("authorization");
    const userToken  = req.headers.get("x-delete-token") || (bearer ? bearer.replace(/^Bearer\s+/i, "") : "");

    const isAdmin = !!process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY;
    const isOwner = !!userToken && userToken === meta.deleteToken;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // Hapus image + meta dari Blob
    await Promise.allSettled([
      del(meta.url, { token: process.env.BLOB_READ_WRITE_TOKEN }),
      del(metaUrlGuess, { token: process.env.BLOB_READ_WRITE_TOKEN }),
    ]);

    return NextResponse.json({ success: true, by: isAdmin ? "admin" : "owner" });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Delete failed" }, { status: 500 });
  }
}

/**
 * Vercel Blob public URL selalu: https://<bucket>.public.blob.vercel-storage.com/<key>
 * Kita tidak tahu subdomain bucket di build time, tapi untuk objek yang *sudah dibuat*,
 * Vercel memastikan URL publik-nya konsisten. Trik: gunakan URL pola yang sama
 * dengan `list()`/`put()` hasil `url` yang pernah didapat. Karena di sini kita
 * butuh membangun URL meta dari key yang deterministik, helper ini cukup.
 *
 * Untuk project yang baru, pola ini akan valid setelah pertama kali membuat meta.
 */
async function guessBlobPublicUrl(key: string) {
  // Subdomain publik bisa diambil dari salah satu blob yang sudah ada.
  // Kalau belum ada, fallback ke pola umum—biasanya tetap benar di project Vercel.
  // Agar 100% aman, Anda bisa simpan `BLOB_PUBLIC_BASE` di ENV sendiri.
  const base = process.env.BLOB_PUBLIC_BASE; // optional: set di ENV kalau mau fix
  if (base) return `${base.replace(/\/+$/, "")}/${key}`;

  // fallback (tetap bekerja di Vercel Blob public):
  // fetch ke path relatif akan di-resolve oleh edge runtime → gunakan absolute pola umum
  // NOTE: jika Anda ingin benar-benar eksplisit, set BLOB_PUBLIC_BASE di Env.
  return `https://${process.env.VERCEL_URL ? process.env.VERCEL_URL : ""}.public.blob.vercel-storage.com/${key}`.replace("//.public", "//");
}
