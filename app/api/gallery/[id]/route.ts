// app/api/gallery/[id]/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { list, put, del } from "@vercel/blob";

const META_KEY = "gallery/metadata.json";

async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function loadMeta(): Promise<any[]> {
  const l = await list({ prefix: META_KEY });
  const blob = l.blobs.find(b => b.pathname === META_KEY);
  if (!blob) return [];
  const res = await fetch(blob.url, { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json().catch(() => [])) as any[];
}

async function saveMeta(items: any[]) {
  await put(META_KEY, JSON.stringify(items, null, 2), {
    access: "public",
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> } // Next 15 expects Promise
) {
  try {
    const { id } = await context.params;

    // token owner via header atau body
    let token =
      req.headers.get("x-delete-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";
    if (!token) {
      const body = await req.json().catch(() => ({}));
      token = String(body?.ownerToken || "");
    }

    const adminKey = req.headers.get("x-admin-key") || "";
    const isAdmin = !!process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY;

    const items = await loadMeta();
    const idx = items.findIndex(it => it.id === id);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const item = items[idx];

    if (!isAdmin) {
      if (!token) return NextResponse.json({ success: false, error: "Missing token" }, { status: 401 });
      const hash = await sha256Hex(token);
      if (hash !== item.ownerTokenHash) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
      }
    }

    // hapus file gambar di Blob
    try {
      await del(item.imageUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      // abaikan error fisik
    }

    // hapus dari metadata
    items.splice(idx, 1);
    await saveMeta(items);

    return NextResponse.json({ success: true, by: isAdmin ? "admin" : "owner" });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Delete failed" }, { status: 500 });
  }
}
