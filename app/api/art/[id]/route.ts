// /app/api/art/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";

export const runtime = "nodejs";

// Hapus artwork: verifikasi owner-token lalu bersihkan data turunan yang perlu
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    // Ambil data art dari KV
    const raw = await kv.get(`art:${id}`);
    if (!raw) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    const art = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Owner token bisa dikirim via header atau body (kompatibel dengan versi kamu)
    const headerToken =
      req.headers.get("x-owner-token") ||
      req.headers.get("x-delete-token") || // fallback
      "";

    let bodyToken = "";
    let metaUrlFromBody: string | undefined;
    try {
      const body = await req.json();
      bodyToken = body?.token || "";
      metaUrlFromBody = body?.metaUrl; // kalau kamu mau pakai untuk hapus blob/meta
    } catch {
      // body optional untuk request DELETE
    }

    const token = headerToken || bodyToken;
    if (!token || token !== art.ownerTokenHash) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Hapus record utama
    await kv.del(`art:${id}`);

    // (Opsional) bersihkan turunan—sesuaikan dengan skema kamu
    await kv.del(`likes:${id}`).catch(() => {});
    // Contoh kalau kamu punya index/ranking, tambahkan di sini:
    // await kv.zrem("idx:gallery", id).catch(() => {});
    // await kv.zrem(`rank:daily:${someKey}`, id).catch(() => {});
    // await kv.zrem(`rank:weekly:${someKey}`, id).catch(() => {});
    // await kv.zrem(`rank:monthly:${someKey}`, id).catch(() => {});

    // (Opsional) hapus file meta/blob jika diperlukan.
    // const metaUrl = metaUrlFromBody || art.metaUrl;
    // if (metaUrl) { ... panggil storage remove ... }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
