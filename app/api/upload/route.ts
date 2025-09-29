import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "edge";

const sha256Hex = async (text: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
};
const toXUrl = (h: string) => `https://x.com/${(h || "").trim().replace(/^@/, "")}`;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const title = (form.get("title") as string || "").trim();
  const xHandle = (form.get("xHandle") as string || "").trim();
  const discord = (form.get("discord") as string || "").trim();
  const ownerToken = (form.get("ownerToken") as string || "").trim();

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!xHandle || !discord || !ownerToken) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const id = crypto.randomUUID();
  const ext = file.type?.split("/")[1] ? `.${file.type.split("/")[1]}` : "";

  // Upload image
  const imageBlob = await put(`art/${id}${ext}`, file, {
    access: "public",
    contentType: file.type || "application/octet-stream",
  });

  const metaBase = {
    id,
    title,
    imageUrl: imageBlob.url,
    xHandle,
    xUrl: toXUrl(xHandle),
    discord,
    createdAt: Date.now(),
    ownerTokenHash: await sha256Hex(ownerToken),
  };

  // Upload metadata & then update with metaUrl
  const metaBlob = await put(`art-meta/${id}.json`, JSON.stringify(metaBase), {
    access: "public",
    contentType: "application/json",
  });

  const finalMeta = { ...metaBase, metaUrl: metaBlob.url };

  await put(`art-meta/${id}.json`, JSON.stringify(finalMeta), {
    access: "public",
    contentType: "application/json",
  });

  return NextResponse.json(finalMeta);
}
