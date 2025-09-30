// app/api/art/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { createHash } from "crypto";

/**
 * DELETE /api/art/:id
 *
 * Body (JSON), two modes:
 * 1) Owner delete (default)
 *    { token: string, metaUrl: string }
 *    - token   : delete token saved in localStorage at submit time
 *    - metaUrl : URL to metadata JSON on Vercel Blob
 *    Server will:
 *      - fetch metaUrl
 *      - verify sha256(token) === meta.ownerTokenHash (or legacy: token === meta.deleteToken)
 *      - delete image (meta.imageUrl) and metadata (metaUrl)
 *
 * 2) Admin delete (override)
 *    { metaUrl: string }
 *    and send header:  x-admin-key: <your NEXT_PUBLIC_ADMIN_KEY>
 *    Server will check header against process.env.ADMIN_KEY, then delete without token check.
 */
export async function DELETE(
  req: NextRequest,
  _ctx: { params: Promise<{ id: string }> } // Next.js 15: params is a Promise (not used here)
) {
  try {
    const { token, metaUrl } = await req.json().catch(() => ({} as any));

    const RW = process.env.BLOB_READ_WRITE_TOKEN;
    if (!RW) {
      return NextResponse.json(
        { error: "Server misconfigured: missing BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }

    // ---------------------------
    // ADMIN OVERRIDE (header)
    // ---------------------------
    const adminHeader = req.headers.get("x-admin-key") || "";
    const serverAdminKey = process.env.ADMIN_KEY || "";

    if (serverAdminKey && adminHeader && adminHeader === serverAdminKey) {
      if (!metaUrl) {
        return NextResponse.json(
          { error: "Missing token or metaUrl" },
          { status: 400 }
        );
      }

      // fetch meta to find imageUrl (best-effort)
      try {
        const metaRes = await fetch(metaUrl, { cache: "no-store" });
        if (metaRes.ok) {
          const meta: any = await metaRes.json().catch(() => ({}));
          const tasks: Promise<any>[] = [];
          if (meta?.imageUrl) tasks.push(del(meta.imageUrl, { token: RW }));
          tasks.push(del(metaUrl, { token: RW }));
          await Promise.allSettled(tasks);
        } else {
          // even if meta not found, still try to delete the metaUrl itself
          await del(metaUrl, { token: RW }).catch(() => {});
        }
      } catch {
        // ignore fetch/delete errors so admin flow is resilient
      }

      return NextResponse.json({ success: true, by: "admin" });
    }

    // ---------------------------
    // OWNER DELETE (token check)
    // ---------------------------
    if (!token || !metaUrl) {
      return NextResponse.json(
        { error: "Missing token or metaUrl" },
        { status: 400 }
      );
    }

    // Load metadata
    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const meta: any = await metaRes.json();

    // Verify ownership:
    // - new model: sha256(token) === meta.ownerTokenHash
    // - legacy   : token === meta.deleteToken
    let isOwner = false;
    if (meta?.ownerTokenHash) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      isOwner = tokenHash === meta.ownerTokenHash;
    } else if (meta?.deleteToken) {
      isOwner = token === meta.deleteToken;
    }

    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete image + meta
    const tasks: Promise<any>[] = [];
    if (meta?.imageUrl) tasks.push(del(meta.imageUrl, { token: RW }));
    tasks.push(del(metaUrl, { token: RW }));
    await Promise.allSettled(tasks);

    return NextResponse.json({ success: true, by: "owner" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Delete failed" },
      { status: 500 }
    );
  }
}
