export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const adminKey = _req.headers.get("x-admin-key") || "";
    const token =
      _req.headers.get("x-delete-token") ||
      _req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    const dataFile = path.join(process.cwd(), "data", "gallery.json");
    let items: any[] = [];
    try {
      items = JSON.parse(await fs.readFile(dataFile, "utf-8"));
    } catch {}

    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const item = items[idx];

    // 🔑 ADMIN override
    if (process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY) {
      await doDelete(items, idx, dataFile, item);
      return NextResponse.json({ success: true, by: "admin" });
    }

    // ✅ Normal flow pakai deleteToken
    if (!token) {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 401 });
    }
    if (item.deleteToken !== token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    await doDelete(items, idx, dataFile, item);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Delete failed" }, { status: 500 });
  }
}

async function doDelete(items: any[], idx: number, dataFile: string, item: any) {
  try {
    if (item.storage?.kind === "local" && item.storage?.path) {
      await fs.unlink(item.storage.path).catch(() => {});
    }
    // kalau pakai blob → di sini panggil delete API blob
  } catch {}
  items.splice(idx, 1);
  await fs.writeFile(dataFile, JSON.stringify(items, null, 2), "utf-8");
}

