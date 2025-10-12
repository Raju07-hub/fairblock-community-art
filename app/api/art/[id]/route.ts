// /app/api/art/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { del as blobDel, put as blobPut } from "@vercel/blob";

type Params = { id: string };

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function normHandle(v: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  return "@" + s.replace(/^@/, "");
}
function normPostUrl(u: string) {
  const s = String(u || "").trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : "";
}

/** -------- DELETE: hapus image + meta di Blob -------- */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<Params> } // Next.js 15
) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });
    }

    const { id } = await context.params;
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    const headerToken = req.headers.get("x-owner-token") || req.headers.get("x-delete-token") || "";
    let bodyToken = "", metaUrlFromBody = "";
    try {
      const body = await req.json();
      bodyToken = body?.token || "";
      metaUrlFromBody = body?.metaUrl || "";
    } catch {}

    const providedToken = headerToken || bodyToken;
    if (!metaUrlFromBody) {
      return NextResponse.json({ success: false, error: "Missing metaUrl" }, { status: 400 });
    }

    const metaRes = await fetch(metaUrlFromBody, { cache: "no-store" });
    if (!metaRes.ok) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const meta = await metaRes.json();

    const okAuth =
      !!providedToken &&
      (providedToken === meta.ownerTokenHash || sha256(providedToken) === meta.ownerTokenHash);
    if (!okAuth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const urls: string[] = [];
    if (meta?.imageUrl) urls.push(meta.imageUrl);
    urls.push(metaUrlFromBody);

    await blobDel(urls, { token: process.env.BLOB_READ_WRITE_TOKEN! });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

/** -------- PUT: edit metadata (title/x/discord/postUrl) -------- */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<Params> } // Next.js 15
) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ success: false, error: "Missing BLOB_READ_WRITE_TOKEN" }, { status: 500 });
    }

    const { id } = await context.params;
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    const headerToken = req.headers.get("x-owner-token") || "";

    const body = await req.json().catch(() => ({} as any));
    const {
      token: bodyToken,
      metaUrl,          // wajib agar kita bisa baca meta lama
      title,
      x,
      discord,
      postUrl,
    } = body || {};

    if (!metaUrl) {
      return NextResponse.json({ success: false, error: "Missing metaUrl" }, { status: 400 });
    }

    // 1) Baca meta lama dari Blob
    const metaRes = await fetch(metaUrl, { cache: "no-store" });
    if (!metaRes.ok) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const oldMeta = await metaRes.json();

    // 2) Auth: izinkan raw deleteToken atau ownerTokenHash
    const providedToken = headerToken || bodyToken || "";
    const okAuth =
      !!providedToken &&
      (providedToken === oldMeta.ownerTokenHash || sha256(providedToken) === oldMeta.ownerTokenHash);
    if (!okAuth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    // 3) Siapkan meta baru (imageUrl & ownerTokenHash tetap)
    const newMeta = {
      id: oldMeta.id,
      title: String(title ?? oldMeta.title).trim(),
      x: normHandle(x ?? oldMeta.x),
      discord: normHandle(discord ?? oldMeta.discord),
      postUrl: normPostUrl(postUrl ?? oldMeta.postUrl),
      imageUrl: oldMeta.imageUrl,
      createdAt: oldMeta.createdAt,
      ownerTokenHash: oldMeta.ownerTokenHash,
    };

    // 4) Tulis ulang meta ke key yang sama (fairblock/meta/{id}.json)
    // Kita derive key dari URL-nya karena saat submit sudah deterministik
    // metaUrl format: https://blob.vercel-storage.com/fairblock/meta/{id}.json?token=...
    // Untuk overwrite, cukup put ke "fairblock/meta/{id}.json"
    const metaKey = `fairblock/meta/${id}.json`;

    await blobPut(
      metaKey,
      Buffer.from(JSON.stringify(newMeta)),
      {
        access: "public",
        contentType: "application/json",
        token: process.env.BLOB_READ_WRITE_TOKEN!,
      }
    );

    return NextResponse.json({ success: true, meta: newMeta });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
