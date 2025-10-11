export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get("scope") || "daily").toLowerCase();
    const key = searchParams.get("key") || "";

    if ((scope !== "daily" && scope !== "weekly") || !key) {
      return NextResponse.json({ error: "Invalid scope or key" }, { status: 400 });
    }

    const artKey = `lb:art:${scope}:${key}`;
    const creatorKey = `lb:creator:${scope}:${key}`;

    const arts = (await (kv as any).zrevrange(artKey, 0, 99, { withScores: true })) as Array<string | number> | null;
    const creators = (await (kv as any).zrevrange(creatorKey, 0, 99, { withScores: true })) as Array<string | number> | null;

    function pairs(arr: Array<string | number> | null) {
      if (!arr || !arr.length) return [] as { id: string; score: number }[];
      const out: { id: string; score: number }[] = [];
      for (let i = 0; i < arr.length; i += 2) {
        out.push({ id: String(arr[i]), score: Number(arr[i + 1]) });
      }
      return out;
    }

    return NextResponse.json({
      success: true,
      scope,
      key,
      top_art: pairs(arts),
      top_creators: pairs(creators).map((x) => ({ user: x.id, uploads: x.score })), // uploads == score (periode)
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
