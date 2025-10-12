export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

/* --- utilities --- */
async function getParams(
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
): Promise<{ id: string }> {
  // @ts-ignore
  const p = (context as any).params;
  return typeof p?.then === "function" ? await p : p;
}

function normHandle(v?: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  const noAt = s.replace(/^@/, "");
  return `@${noAt}`;
}

type PatchBody = {
  token?: string;
  metaUrl?: string;
  patch?: Partial<{ title: string; x: string; discord: string; postUrl: string }>;
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
    const v = (patch as any)[k];
    if (k === "x" || k === "discord") next[k] = normHandle(v);
    else next[k] = String(v || "");
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

async function saveMeta(id: string, meta: any) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is missing");
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

/* --- NEW: token validation that supports legacy keys + admin override --- */
function extractMetaTokens(meta: any): string[] {
  const candidates = [
    meta?.ownerToken,
    meta?.token,
    meta?.owner_token,
    meta?.deleteToken,
    meta?.delToken,
    meta?.delete_token,
    meta?.owner,
  ];
  return candidates.filter((x) => typeof x === "string" && x.length > 0);
}

function isAdminOverride(req: NextRequest): boolean {
  const hdr = req.headers.get("x-admin-token") || "";
  const admin = process.env.ADMIN_TOKEN || "";
  return !!admin && hdr && hdr === admin;
}

async function handleUpdate(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const { id } = await getParams(context);
  const body = (await req.json().catch(() => ({}))) as PatchBody;

  if (!id || !body?.token || !body?.metaUrl || !body?.patch) {
    return NextResponse.json(
      { success: false, error: "Missing token, metaUrl or patch" },
      { status: 400 }
    );
  }

  // load current meta
  const curr = await loadMeta(body.metaUrl);

  // admin override?
  if (!isAdminOverride(req)) {
    const metaTokens = extractMetaTokens(curr);
    if (metaTokens.length > 0) {
      // meta memiliki token → harus match salah satu
      if (!metaTokens.includes(body.token)) {
        return NextResponse.json(
          { success: false, error: "Invalid token (not the owner)" },
          { status: 401 }
        );
      }
    }
    // jika meta TIDAK punya token sama sekali -> izinkan (untuk unggahan lama)
  }

  const next = mergeMeta(curr, body.patch);
  next.id = String(curr.id || id);
  next.imageUrl = curr.imageUrl || curr.url || "";

  const newMetaUrl = await saveMeta(id, next);
  return NextResponse.json({ success: true, metaUrl: newMetaUrl, meta: next });
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
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

export async function POST(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const hdr = req.headers.get("x-http-method-override");
  if (hdr?.toUpperCase() === "PATCH") return PATCH(req, context);
  return new Response("Method Not Allowed", { status: 405 });
}
