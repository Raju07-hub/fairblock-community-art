// app/api/gallery/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Bentuk item seperti yang disimpan saat upload
type GalleryItem = {
  id: string;
  title: string;
  x?: string;
  discord?: string;
  url: string; // kalau Blob: ini URL file blob
  createdAt: string;
  deleteToken: string;
  storage?: {
    kind: "local" | "blob";
    path?: string;    // local absolute path
    blobKey?: string; // optional key/path blob
  };
};

const DATA_FILE = path.join(process.cwd(), "data", "gallery.json");

async function loadList(): Promise<GalleryItem[]> {
  if (!existsSync(DATA_FILE)) return [];
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as GalleryItem[];
  } catch {
    return [];
  }
}

async function saveList(list: GalleryItem[]) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Next.js 15: params adalah Promise
    const { id } = await context.params;

    const adminHeader = req.headers.get("x-admin-key") || "";
    const bearer = req.headers.get("authorization");
    const tokenHeader =
      req.headers.get("x-delete-token") ||
      (bearer ? bearer.replace(/^Bearer\s+/i, "") : "");

    const list = await loadList();
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const item = list[idx];

    // 🔑 Admin override
    const isAdmin = !!process.env.ADMIN_KEY && adminHeader === process.env.ADMIN_KEY;
    const isOwner = tokenHeader && tokenHeader === item.deleteToken;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // 🧹 Hapus file fisik
    try {
      if (item.storage?.kind === "local" && item.storage.path) {
        await fs.unlink(item.storage.path).catch(() => {});
      } else if (item.storage?.kind === "blob") {
        // del() butuh token RW + url atau pathname
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const { del } = await import("@vercel/blob");
          const target = item.url || item.storage.blobKey || "";
          if (target) {
            await del(target, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {});
          }
        }
      }
    } catch {
      // abaikan error penghapusan fisik supaya proses tetap lanjut
    }

    // 🗂️ Hapus dari JSON
    list.splice(idx, 1);
    await saveList(list);

    return NextResponse.json({ success: true, by: isAdmin ? "admin" : "owner" });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Delete failed" },
      { status: 500 }
    );
  }
}
