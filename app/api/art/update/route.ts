export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { put } from "@vercel/blob";

type Patch = Partial<{
  title: string;
  x: string;
  discord: string;
  postUrl: string;
}>;

export async function POST(req: Request) {
  try {
    const { token, metaUrl, patch } = (await req.json().catch(() => ({}))) as {
      token?: string;
      metaUrl?: string;
      patch?: Patch;
    };

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing BLOB_READ_WRITE_TOKEN" },
        { status: 500 }
      );
    }
    if (!token || !metaUrl || !patch) {
      return NextResponse.json(
        { success: false, error: "Missing token, metaUrl or patch" },
        { status: 400 }
      );
    }

    // load metadata
    const res = await fetch(metaUrl, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    const meta = await res.json();

    // verify owner
    let isOwner = false;
    if (meta?.ownerTokenHash) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      isOwner = tokenHash === meta.ownerTokenHash;
    } else if (meta?.deleteToken) {
      // legacy
      isOwner = token === meta.deleteToken;
    }
    if (!isOwner) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // sanitize allowed fields only
    const nextMeta = { ...meta };
    if (typeof patch.title === "string") nextMeta.title = patch.title.trim();
    if (typeof patch.x === "string") nextMeta.x = patch.x.trim();
    if (typeof patch.discord === "string") nextMeta.discord = patch.discord.trim();
    if (typeof patch.postUrl === "string") {
      const v = patch.postUrl.trim();
      nextMeta.postUrl = v || undefined; // kosongkan kalau user hapus
    }

    // re-put same meta file
    await put(
      // use same key by reading from metaUrl path after domain
      // safer: rely on vercel/blob put with URL path
      metaUrl,
      Buffer.from(JSON.stringify(nextMeta)),
      {
        access: "public",
        contentType: "application/json",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      } as any
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Update failed" },
      { status: 500 }
    );
  }
}
