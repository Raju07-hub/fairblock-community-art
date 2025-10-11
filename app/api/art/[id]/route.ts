export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

/** Normalisasi handle: selalu berawalan @, kosong = "" */
function normHandle(v?: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  const noAt = s.replace(/^@/, "");
  return `@${noAt}`;
}

type PatchBody = {
  token?: string;
  metaUrl?: string;
  patch?: Partial<{
    title: string;
    x: string;
    discord: string;
    postUrl: string;
  }>;
};

/** Field yang boleh diedit */
const ALLOWED_FIELDS = new Set(["title", "x", "discord", "postUrl"]);

/** Load meta JSON dari metaUrl */
async function loadMeta(metaUrl: string) {
  const res = await fetch(metaUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Load meta failed: ${res.status}`);
  return res.json();
}

/** Merge patch ke meta lama (dengan normalisasi dan sanitasi) */
function mergeMeta(curr: any, patch: PatchBody["patch"]) {
  const next: any = { ...curr };
  for (const k of Object.keys(patch || {})) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    const val = (patch as any)[k];
    if (k === "x" || k === "discord") {
      next[k] = normHandle(val);
    } else if (k === "postUrl") {
      next[k] = String(val || "");
    } else if (k === "title") {
      next[k] = String(val || "");
    }
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

/**
 * Simpan meta ke path deterministik: fairblock/meta/{id}.json
 * addRandomSuffix:false agar overwrite (bukan bikin file baru).
 */
async function saveMeta(id: string, meta: any) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is missing");
  }
  const path = `fairblock/meta/${id}.json`;
  const { url } = await put(path, JSON.stringify(meta, null, 2), {
    access: "public",
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
  return url;
}

/** PATCH/PUT: update meta artwork */
async function handleUpdate(req: Request, params: { id: string }) {
  const id = params.id;
  const body = (await req.json().catch(() => ({}))) as PatchBody;

  if (!id || !body?.token || !body?.metaUrl || !body?.patch) {
    return NextResponse.json(
      { success: false, error: "Missing token, metaUrl or patch" },
      { status: 400 }
    );
  }

  // 1) Ambil meta lama
  const curr = await loadMeta(body.metaUrl);

  // 2) Validasi owner token (meta harus punya ownerToken yang sama)
  const ownerTokenInMeta = curr?.ownerToken || curr?.token || curr?.owner_token;
  if (!ownerTokenInMeta || ownerTokenInMeta !== body.token) {
    return NextResponse.json(
      { success: false, error: "Invalid token (not the owner)" },
      { status: 401 }
    );
  }

  // 3) Merge patch
  const next = mergeMeta(curr, body.patch);

  // Pastikan id & imageUrl tetap ada
  next.id = String(curr.id || id);
  next.imageUrl = curr.imageUrl || curr.url || "";

  // 4) Simpan balik ke Blob (overwrite)
  const newMetaUrl = await saveMeta(id, next);

  return NextResponse.json({
    success: true,
    metaUrl: newMetaUrl,
    meta: next,
  });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    return await handleUpdate(req, ctx.params);
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Update failed" },
      { status: 500 }
    );
  }
}

// Dukung PUT juga
export const PUT = PATCH;

// Dukung POST override (X-HTTP-Method-Override: PATCH)
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const hdr = req.headers.get("x-http-method-override");
  if (hdr?.toUpperCase() === "PATCH") {
    return PATCH(req, ctx);
  }
  return new Response("Method Not Allowed", { status: 405 });
}
