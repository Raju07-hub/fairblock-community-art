export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

/** helper: ambil params baik berbentuk object maupun Promise */
async function getParams(
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
): Promise<{ id: string }> {
  // @ts-ignore - duck-typing untuk Promise
  const p = (context as any).params;
  return typeof p?.then === "function" ? await p : p;
}

/** Normalisasi handle */
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

const ALLOWED_FIELDS = new Set(["title", "x", "discord", "postUrl"]);

async function loadMeta(metaUrl: string) {
  const res = await fetch(metaUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Load meta failed: ${res.status}`);
  return res.json();
}

function mergeMeta(curr: any, patch: PatchBody["patch"]) {
  const next: any = { ...curr };
  for (const k of Object.keys(patch || {})) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    const val = (patch as any)[k];
    if (k === "x" || k === "discord") next[k] = normHandle(val);
    else if (k === "postUrl" || k === "title") next[k] = String(val || "");
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

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

async function handleUpdate(req: NextRequest, context:
  { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const { id } = await getParams(context);
  const body = (await req.json().catch(() => ({}))) as PatchBody;

  if (!id || !body?.token || !body?.metaUrl || !body?.patch) {
    return NextResponse.json(
      { success: false, error: "Missing token, metaUrl or patch" },
      { status: 400 }
    );
  }

  // 1) meta lama
  const curr = await loadMeta(body.metaUrl);

  // 2) validasi owner token
  const ownerTokenInMeta = curr?.ownerToken || curr?.token || curr?.owner_token;
  if (!ownerTokenInMeta || ownerTokenInMeta !== body.token) {
    return NextResponse.json(
      { success: false, error: "Invalid token (not the owner)" },
      { status: 401 }
    );
  }

  // 3) merge
  const next = mergeMeta(curr, body.patch);
  next.id = String(curr.id || id);
  next.imageUrl = curr.imageUrl || curr.url || "";

  // 4) simpan ke Blob (overwrite)
  const newMetaUrl = await saveMeta(id, next);

  return NextResponse.json({ success: true, metaUrl: newMetaUrl, meta: next });
}

/** PATCH/PUT */
export async function PATCH(req: NextRequest, context:
  { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    return await handleUpdate(req, context);
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Update failed" },
      { status: 500 }
    );
  }
}
export const PUT = PATCH;

/** POST override (X-HTTP-Method-Override: PATCH) */
export async function POST(req: NextRequest, context:
  { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const hdr = req.headers.get("x-http-method-override");
  if (hdr?.toUpperCase() === "PATCH") {
    return PATCH(req, context);
  }
  return new Response("Method Not Allowed", { status: 405 });
}
