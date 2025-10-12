export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { put as blobPut, del as blobDel } from "@vercel/blob";

type Params = { id: string };
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const normHandle = (v?: string) => (v ? "@" + String(v).trim().replace(/^@/, "") : "");
const normPostUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : "");

/* === OPTIONS (biar ga 405 preflight) === */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-owner-token, x-delete-token",
    },
  });
}

/* === GET (cek meta cepat) === */
export async function GET(_: NextRequest, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;
  return NextResponse.json({ success: true, id });
}

/* === DELETE: hapus image + meta === */
export async function DELETE(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const metaUrl = body?.metaUrl || "";
    const providedToken =
      req.headers.get("x-owner-token") || req.headers.get("x-delete-token") || body?.token || "";

    if (!process.env.BLOB_READ_WRITE_TOKEN)
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    if (!metaUrl) return NextResponse.json({ success: false, error: "Missing metaUrl" }, { status: 400 });

    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const meta = await metaRes.json();

    const auth =
      !!providedToken &&
      (providedToken === meta.ownerTokenHash || sha256(providedToken) === meta.ownerTokenHash);
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const files = [metaUrl];
    if (meta.imageUrl) files.push(meta.imageUrl);
    await blobDel(files, { token: process.env.BLOB_READ_WRITE_TOKEN! });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Delete failed" }, { status: 500 });
  }
}

/* === PUT / POST: edit meta JSON === */
async function handleEdit(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const { id } = await ctx.params;
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const { token, metaUrl, title, x, discord, postUrl } = body || {};
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    if (!metaUrl) return NextResponse.json({ success: false, error: "Missing metaUrl" }, { status: 400 });

    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const old = await metaRes.json();

    const provided = req.headers.get("x-owner-token") || token || "";
    const ok =
      !!provided &&
      (provided === old.ownerTokenHash || sha256(provided) === old.ownerTokenHash);
    if (!ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const updated = {
      id: old.id,
      title: String(title ?? old.title).trim(),
      x: normHandle(x ?? old.x),
      discord: normHandle(discord ?? old.discord),
      postUrl: normPostUrl(postUrl ?? old.postUrl),
      imageUrl: old.imageUrl,
      createdAt: old.createdAt,
      ownerTokenHash: old.ownerTokenHash,
    };

    await blobPut(`fairblock/meta/${id}.json`, Buffer.from(JSON.stringify(updated)), {
      access: "public",
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });

    return NextResponse.json({ success: true, meta: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Edit failed" }, { status: 500 });
  }
}

export const PUT = handleEdit;
export const POST = handleEdit;
