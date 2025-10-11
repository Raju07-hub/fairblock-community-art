export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

type PutFn = (path: string, body: any, opts: any) => Promise<{ url: string }>;

export async function POST(req: Request) {
  try {
    const { metaUrl, ownerTokenHash, patch } = await req.json().catch(() => ({}));
    if (!metaUrl || !ownerTokenHash || !patch || typeof patch !== "object") {
      return NextResponse.json({ error: "Missing metaUrl/ownerTokenHash/patch" }, { status: 400 });
    }

    // read current meta
    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) return NextResponse.json({ error: "Meta not found" }, { status: 404 });
    const meta = await metaRes.json();

    // verify owner or admin override
    if (meta.ownerTokenHash !== ownerTokenHash) {
      const adminKey = req.headers.get("x-admin-key");
      if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // whitelist fields
    const newMeta = {
      ...meta,
      title: typeof patch.title === "string" ? patch.title : meta.title,
      x: typeof patch.x === "string" ? patch.x : meta.x,
      discord: typeof patch.discord === "string" ? patch.discord : meta.discord,
      postUrl: typeof patch.postUrl === "string" ? patch.postUrl : meta.postUrl,
      updatedAt: new Date().toISOString(),
    };

    // overwrite same blob (no random suffix)
    const u = new URL(metaUrl);
    const pathname = decodeURIComponent(u.pathname).replace(/^\//, "");

    const { put } = (await import("@vercel/blob")) as { put: PutFn };
    await put(
      pathname,
      JSON.stringify(newMeta, null, 2),
      {
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: "application/json",
        access: "public",
        addRandomSuffix: false,
      }
    );

    return NextResponse.json({ ok: true, meta: newMeta, metaUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Update failed" }, { status: 500 });
  }
}
