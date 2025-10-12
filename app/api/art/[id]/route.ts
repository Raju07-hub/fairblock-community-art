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

/* ====== OPTIONS (untuk preflight/keamanan) ====== */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      // same-origin seharusnya aman tanpa CORS, tapi ini aman untuk preflight
      "Access-Control-Allow-Methods": "PUT,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-owner-token, x-delete-token",
    },
  });
}

/* ====== DELETE: hapus image + meta (Blob) ====== */
export async function DELETE(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });
    }
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    const headerToken = req.headers.get("x-owner-token") || req.headers.get("x-delete-token") || "";
    const body = await req.json().catch(() => ({} as any));
    const metaUrl: string = body?.metaUrl || "";
    const provided = headerToken || body?.token || "";
    if (!metaUrl) return NextResponse.json({ success: false, error: "Missing metaUrl" }, { status: 400 });

    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const meta = await metaRes.json();

    const ok = !!provided && (provided === meta.ownerTokenHash || sha256(provided) === meta.ownerTokenHash);
    if (!ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const toDelete = [metaUrl];
    if (meta?.imageUrl) toDelete.push(meta.imageUrl);
    await blobDel(toDelete, { token: process.env.BLOB_READ_WRITE_TOKEN! });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

/* ====== PUT: edit metadata (title/x/discord/postUrl) ====== */
export async function PUT(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });
    }
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    const headerToken = req.headers.get("x-owner-token") || "";
    const body = await req.json().catch(() => ({} as any));
    const { token: bodyToken, metaUrl, title, x, discord, postUrl } = body || {};
    if (!metaUrl) return NextResponse.json({ success: false, error: "Missing metaUrl" }, { status: 400 });

    // baca meta lama
    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const old = await metaRes.json();

    // auth
    const provided = headerToken || bodyToken || "";
    const ok = !!provided && (provided === old.ownerTokenHash || sha256(provided) === old.ownerTokenHash);
    if (!ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    // meta baru
    const nextMeta = {
      id: old.id,
      title: String(title ?? old.title).trim(),
      x: normHandle(x ?? old.x),
      discord: normHandle(discord ?? old.discord),
      postUrl: normPostUrl(postUrl ?? old.postUrl),
      imageUrl: old.imageUrl,
      createdAt: old.createdAt,
      ownerTokenHash: old.ownerTokenHash,
    };

    // overwrite di key deterministik
    await blobPut(`fairblock/meta/${id}.json`, Buffer.from(JSON.stringify(nextMeta)), {
      access: "public",
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });

    return NextResponse.json({ success: true, meta: nextMeta });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

/* ====== POST: alias ke PUT (untuk form/JS yang masih POST) ====== */
export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  return PUT(req, ctx);
}
