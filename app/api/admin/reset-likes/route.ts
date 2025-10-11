export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import kv from "@/lib/kv";

/**
 * POST /api/admin/reset-likes
 * Headers:
 *   x-admin-key: <ADMIN_KEY>
 */
export async function POST(req: Request) {
  try {
    const adminKeyHdr = req.headers.get("x-admin-key") || "";
    const ADMIN = process.env.ADMIN_KEY || "";
    if (!ADMIN || adminKeyHdr !== ADMIN) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    let deleted = 0;

    // 1) wipe all like-related keys (counts + user flags)
    // vercel/kv: scanIterator available
    for await (const key of (kv as any).scanIterator?.({ match: "likes:*" }) ?? []) {
      await kv.del(String(key));
      deleted++;
    }

    // 2) wipe all leaderboards
    for await (const key of (kv as any).scanIterator?.({ match: "lb:*" }) ?? []) {
      await kv.del(String(key));
      deleted++;
    }

    return NextResponse.json({ success: true, deleted });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Reset failed" },
      { status: 500 }
    );
  }
}
