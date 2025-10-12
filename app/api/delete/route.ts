// /app/api/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // id bisa dari query (?id=...) atau body JSON { id }
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id") || "";
    if (!id) {
      const body = await req.json().catch(() => null);
      id = body?.id || "";
    }
    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    // Ambil data artwork
    const raw = await kv.get(`art:${id}`);
    if (!raw) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    const art = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Verifikasi pemilik via header
    const ownerToken =
      req.headers.get("x-owner-token") ||
      req.headers.get("x-delete-token") || // kompatibel jika sebelumnya pakai nama ini
      "";

    if (!ownerToken || ownerToken !== art.ownerTokenHash) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Hapus data utama
    await kv.del(`art:${id}`);

    // (Opsional) bersihkan turunan/caches sesuai skema yang kamu pakai
    await kv.del(`likes:${id}`).catch(() => {});
    // Jika kamu menyimpan indeks list/ranking, hapus juga di sini (contoh):
    // await kv.zrem("idx:gallery", id).catch(() => {});
    // await kv.zrem(`rank:daily:${art.createdAt?.slice(0,10)}`, id).catch(() => {});
    // await kv.zrem(`rank:weekly:${someWeekKey}`, id).catch(() => {});
    // await kv.zrem(`rank:monthly:${art.createdAt?.slice(0,7)}`, id).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
