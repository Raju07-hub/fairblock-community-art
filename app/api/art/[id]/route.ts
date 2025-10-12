// /app/api/art/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";

export const runtime = "nodejs";
// (opsional) jika data sering berubah:
// export const dynamic = "force-dynamic";

type Params = { id: string };

// DELETE /api/art/:id
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<Params> } // Next.js 15: params is a Promise
) {
  try {
    const { id } = await context.params; // ← WAJIB di-await
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    const raw = await kv.get(`art:${id}`);
    if (!raw) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    const art = typeof raw === "string" ? JSON.parse(raw) : (raw as any);

    // Ambil token dari header atau body (kompatibel dengan client-mu)
    const headerToken =
      req.headers.get("x-owner-token") ||
      req.headers.get("x-delete-token") ||
      "";

    let bodyToken = "";
    let metaUrlFromBody: string | undefined;
    try {
      const body = await req.json();
      bodyToken = body?.token || "";
      metaUrlFromBody = body?.metaUrl;
    } catch {
      // body optional untuk DELETE
    }

    const token = headerToken || bodyToken;
    if (!token || token !== art.ownerTokenHash) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Hapus data utama
    await kv.del(`art:${id}`);

    // (Opsional) bersihkan turunan/caches sesuai skema kamu
    await kv.del(`likes:${id}`).catch(() => {});
    // contoh bersihkan index/ranking jika ada:
    // await kv.zrem("idx:gallery", id).catch(() => {});
    // await kv.zrem(`rank:daily:${someKey}`, id).catch(() => {});
    // await kv.zrem(`rank:weekly:${someKey}`, id).catch(() => {});
    // await kv.zrem(`rank:monthly:${someKey}`, id).catch(() => {});

    // (Opsional) hapus file meta/blob:
    // const metaUrl = metaUrlFromBody || art.metaUrl;
    // if (metaUrl) { ... }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
