// app/api/leaderboard/route.ts
import { NextResponse } from "next/server";
import kv from "@/lib/kv";

// --- helper waktu UTC ---
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function isoDateUTC(d = new Date()) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function isoWeekUTC(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // ISO: Senin=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Kamis pekan itu
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (date.getTime() - firstThu.getTime()) / 86400000;
  const week = 1 + Math.floor(diff / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

function zkey(period: "daily" | "weekly") {
  const day = isoDateUTC();
  const week = isoWeekUTC();
  const suffix = period === "weekly" ? week : day;
  return {
    art: `lb:art:${period}:${suffix}`,
    creator: `lb:creator:${period}:${suffix}`,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Terima 'range' (dipakai page.tsx) atau 'period'
  const q = (searchParams.get("range") || searchParams.get("period") || "daily").toLowerCase();
  const period: "daily" | "weekly" = q === "weekly" ? "weekly" : "daily";

  const keys = zkey(period);

  try {
    // Vercel KV zrange: gunakan { rev: true, withScores: true }
    const rawArts = (await (kv as any).zrange(keys.art, 0, 9, {
      rev: true,
      withScores: true,
    })) as Array<{ member: string; score: number }> | (string | number)[];

    const rawCreators = (await (kv as any).zrange(keys.creator, 0, 9, {
      rev: true,
      withScores: true,
    })) as Array<{ member: string; score: number }> | (string | number)[];

    // Normalisasi hasil agar selalu {member, score}[]
    function normalize(
      raw: Array<{ member: string; score: number }> | (string | number)[]
    ): { member: string; score: number }[] {
      if (!Array.isArray(raw) || raw.length === 0) return [];
      if (typeof raw[0] === "object") return raw as Array<{ member: string; score: number }>;
      const out: { member: string; score: number }[] = [];
      for (let i = 0; i < raw.length; i += 2) {
        out.push({ member: String(raw[i]), score: Number(raw[i + 1] || 0) });
      }
      return out;
    }

    const topArts = normalize(rawArts).map((x) => ({ id: x.member, score: x.score }));
    const topCreators = normalize(rawCreators).map((x) => ({ creator: x.member, score: x.score }));

    // Kembalikan field yang DIHARAPKAN oleh page.tsx
    return NextResponse.json({
      success: true,
      period,
      topArts,
      topCreators,
      // (opsional) tambahkan nama lama demi kompatibilitas
      arts: topArts,
      creators: topCreators,
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: (e as Error).message,
      period,
      topArts: [],
      topCreators: [],
    });
  }
}
