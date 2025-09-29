// app/api/gallery/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const adminKey =
      req.headers.get("x-admin-key") || req.headers.get("x-admin") || "";
    const token =
      req.headers.get("x-delete-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    const dataFile = path.join(process.cwd(), "data", "gallery.json");

    let items: any[] = [];
    try {
      items = JSON.parse(await fs.readFile(dataFile, "utf-8"));
    } catch {
      items = [];
    }

    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const item = items[idx];

    // admin override
    if (process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY) {
      await doDelete(items, idx, dataFile, item);
      return NextResponse.json({ success: true, by: "admin" });
    }

    // owner-token path
    if (!token) {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 401 });
    }
    if (item.deleteToken !== token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    await doDelete(items, idx, dataFile, item);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Delete failed" },
      { status: 500 }
    );
  }
}

async function doDelete(items: any[], idx: number, dataFile: string, item: any) {
  try {
    if (item.storage?.kind === "local" && item.storage?.path) {
      await fs.unlink(item.storage.path).catch(() => {});
    }
    // if using Blob in prod, also delete the blob here.
  } catch {}
  items.splice(idx, 1);
  await fs.writeFile(dataFile, JSON.stringify(items, null, 2), "utf-8");
}
