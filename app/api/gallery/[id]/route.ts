export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function DELETE(_req: Request, _params: { params: { id: string } }) {
  try {
    const id = _params.params.id;
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
    if (!token || item.deleteToken !== token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // hapus file lokal jika ada
    try {
      if (item.storage?.kind === "local" && item.storage?.path) {
        await fs.unlink(item.storage.path).catch(() => {});
      }
    } catch {}

    items.splice(idx, 1);
    await fs.writeFile(dataFile, JSON.stringify(items, null, 2), "utf-8");

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Delete failed" }, { status: 500 });
  }
}
