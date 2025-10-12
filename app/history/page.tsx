"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Range = "weekly" | "monthly";

export default function HistoryPage() {
  const [range, setRange] = useState<Range>("weekly");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const pill = (active: boolean) =>
    `btn px-4 py-1 rounded-full text-sm ${active ? "bg-[#3aaefc]/30" : "bg-white/10"}`;

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/history?range=${range}`, { cache: "no-store" });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || "Failed");
      setItems(j.items || []);
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex gap-3">
          <Link href="/" className="btn">⬅ Back Home</Link>
          <Link href="/gallery" className="btn">🖼️ Gallery</Link>
          <Link href="/submit" className="btn">＋ Submit</Link>
          <Link href="/leaderboard" className="btn">🏆 Leaderboard</Link>
        </div>

        <div className="flex items-center gap-2">
          <button className={pill(range === "weekly")} onClick={() => setRange("weekly")}>Weekly</button>
          <button className={pill(range === "monthly")} onClick={() => setRange("monthly")}>Monthly</button>
          <button className="btn px-4 py-1 rounded-full text-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-3 text-[#3aaefc]">
        📚 Leaderboard History ({range === "weekly" ? "Weekly" : "Monthly"})
      </h2>

      {loading && <p className="opacity-70">Loading…</p>}
      {err && <p className="text-red-400">{err}</p>}
      {!loading && !items.length && <p className="opacity-70">No history found yet.</p>}

      <ul className="mt-4 space-y-2">
        {items.map((key) => {
          const href = `/leaderboard?range=${range}&at=${encodeURIComponent(key)}`;
          return (
            <li key={key} className="flex items-center justify-between bg-white/5 rounded-xl p-4">
              <span className="font-medium">{key}</span>
              <Link href={href} className="btn px-3 py-1 rounded-full text-sm">Open</Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
