// app/api/gallery/route.ts
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

const META_KEY = "gallery/metadata.json";

export async function GET() {
  try {
    const l = await list({ prefix: META_KEY });
    const metaBlob = l.blobs.find(b => b.pathname === META_KEY);
    if (!metaBlob) return NextResponse.json({ success: true, items: [] });

    const res = await fetch(metaBlob.url, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ success: true, items: [] });

    const all = (await res.json().catch(() => [])) as any[];
    // sembunyikan ownerTokenHash dari client
    const items = all.map(({ ownerTokenHash, ...pub }) => pub);

    return NextResponse.json({ success: true, items });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
