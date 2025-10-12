// /app/api/art/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

// Vercel Blob
import { del as blobDel } from "@vercel/blob";

type Params = { id: string };

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

// DELETE /api/art/:id
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<Params> } // Next.js 15: params is a Promise
) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    // Ambil token dari header/body (kompatibel dgn client-mu)
    const headerToken =
      req.headers.get("x-owner-token") ||
      req.headers.get("x-delete-token") ||
      "";

    let bodyToken = "";
    let metaUrlFromBody = "";
    try {
      const body = await req.json();
      bodyToken = body?.token || "";
      metaUrlFromBody = body?.metaUrl || "";
    } catch {
      // body optional untuk DELETE
    }
    const providedToken = headerToken || bodyToken;

    // Butuh metaUrl untuk membaca metadata dari Blob
    if (!metaUrlFromBody) {
      return NextResponse.json(
        { success: false, error: "Missing metaUrl" },
        { status: 400 }
      );
    }

    // 1) Fetch metadata JSON dari Blob
    const metaRes = await fetch(metaUrlFromBody, { cache: "no-store" });
    if (!metaRes.ok) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }
    const meta = await metaRes.json();

    // meta berisi: { id, title, x, discord, postUrl, imageUrl, createdAt, ownerTokenHash }
    if (!meta?.id || meta.id !== id) {
      return NextResponse.json(
        { success: false, error: "Mismatched meta id" },
        { status: 400 }
      );
    }

    // 2) Verifikasi kepemilikan
    //   - Izinkan user kirim raw deleteToken (akan di-hash) ATAU langsung ownerTokenHash
    const okAuth =
      !!providedToken &&
      (providedToken === meta.ownerTokenHash || sha256(providedToken) === meta.ownerTokenHash);

    if (!okAuth) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 3) Hapus file di Blob: image + meta
    const urlsToDelete: string[] = [];
    if (meta.imageUrl) urlsToDelete.push(meta.imageUrl);
    urlsToDelete.push(metaUrlFromBody);

    await blobDel(urlsToDelete, {
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });

    // (Jika kamu punya indeks/leaderboard di KV, bersihkan di sini.)

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
