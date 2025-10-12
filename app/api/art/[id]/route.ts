// /app/api/art/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { del as blobDel, put as blobPut } from "@vercel/blob";

type Params = { id: string };
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const normHandle = (v?: string) => (v ? "@" + String(v).trim().replace(/^@/, "") : "");
const normPostUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : "");

/* ---------- OPTIONS (preflight) ---------- */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-owner-token, x-delete-token",
    },
  });
}

/* ---------- DELETE ---------- */
export async function DELETE(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });

    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({} as any));
    const metaUrl: string = body?.metaUrl || "";
    const provided =
      req.headers.get("x-owner-token") ||
      req.headers.get("x-delete-token") ||
      body?.token ||
      "";

    if (!id || !metaUrl)
      return NextResponse.json({ success: false, error: "Missing id or metaUrl" }, { status: 400 });

    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok)
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const meta = await metaRes.json();

    const ok = !!provided && (provided === meta.ownerTokenHash || sha256(provided) === meta.ownerTokenHash);
    if (!ok)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const files = [metaUrl];
    if (meta?.imageUrl) files.push(meta.imageUrl);
    await blobDel(files, { token: process.env.BLOB_READ_WRITE_TOKEN! });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Delete failed" }, { status: 500 });
  }
}

/* ---------- EDIT (PUT/PATCH/POST) ---------- */
async function editHandler(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });

    const { id } = await ctx.params;
    const raw = await req.json().catch(() => ({} as any));
    const metaUrl: string = raw?.metaUrl || raw?.patch?.metaUrl || "";
    const provided = req.headers.get("x-owner-token") || raw?.token || raw?.patch?.token || "";
    const patch = raw?.patch || raw || {};
    const { title, x, discord, postUrl } = patch;

    if (!id || !metaUrl)
      return NextResponse.json({ success: false, error: "Missing id or metaUrl" }, { status: 400 });

    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok)
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const old = await metaRes.json();

    const ok =
      !!provided &&
      (provided === old.ownerTokenHash || sha256(provided) === old.ownerTokenHash);
    if (!ok)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const now = new Date().toISOString();

    const nextMeta = {
      id: old.id,
      title: String(title ?? old.title).trim(),
      x: normHandle(x ?? old.x),
      discord: normHandle(discord ?? old.discord),
      postUrl: normPostUrl(postUrl ?? old.postUrl),
      imageUrl: old.imageUrl,
      createdAt: old.createdAt,
      updatedAt: now, // ⬅️ penting untuk cache busting
      ownerTokenHash: old.ownerTokenHash,
    };

    await blobPut(`fairblock/meta/${id}.json`, Buffer.from(JSON.stringify(nextMeta)), {
      access: "public",
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      allowOverwrite: true, // ⬅️ fix overwrite error
    });

    return NextResponse.json({ success: true, meta: nextMeta });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Edit failed" }, { status: 500 });
  }
}

export const PUT = editHandler;
export const PATCH = editHandler;
export const POST = editHandler;
