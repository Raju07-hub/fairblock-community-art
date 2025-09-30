// app/api/art/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

type DelFn = (urlOrKey: string, opts: any) => Promise<void>;

export async function DELETE(req: Request, _ctx: { params: Promise<{id:string}> }) {
  try {
    const { ownerTokenHash, metaUrl } = await req.json().catch(() => ({}));
    if (!ownerTokenHash || !metaUrl) {
      return NextResponse.json({ error: "Missing ownerTokenHash or metaUrl" }, { status: 400 });
    }

    // baca metadata
    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const meta = await metaRes.json();

    // cek hash
    if (meta.ownerTokenHash !== ownerTokenHash) {
      // allow admin override via header
      const adminKey = req.headers.get("x-admin-key");
      if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // hapus file
    const { del } = await import("@vercel/blob") as { del: DelFn };
    await del(meta.url, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(()=>{});
    await del(metaUrl,  { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(()=>{});

    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || "Delete failed" }, { status: 500 });
  }
}
