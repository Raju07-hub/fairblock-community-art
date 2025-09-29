import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { ownerTokenHash, metaUrl } = await req.json().catch(() => ({}));
  if (!ownerTokenHash || !metaUrl) return NextResponse.json({ error: "Missing ownerTokenHash or metaUrl" }, { status: 400 });

  const metaRes = await fetch(metaUrl, { cache: "no-store" });
  if (!metaRes.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta = await metaRes.json();
  if (meta.ownerTokenHash !== ownerTokenHash) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await del(meta.imageUrl);
  await del(metaUrl);

  return NextResponse.json({ ok: true });
}
