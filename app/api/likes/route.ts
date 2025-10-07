import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { getUserId } from "@/lib/user-id";

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const likedKey = `likes:user:${userId}`;
    const liked = await kv.smembers<string[]>(likedKey);
    return NextResponse.json({ success: true, liked });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
