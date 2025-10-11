"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TopArt = {
  id: string;
  title?: string;
  owner?: string;
  likes?: number;
  postUrl?: string;
  url?: string;
};

export default function HistoryDetail({
  params,
}: {
  params: { scope: string; key: string };
}) {
  const [topArt, setTopArt] = useState<TopArt[]>([]);
  const [loading, setLoading] = useState(true);

  const scope = params.scope as "daily" | "weekly";
  const key = decodeURIComponent(params.key);

  const btn = "btn px-3 py-1 rounded-full text-xs";
  const badge =
    "px-2.5 py-0.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-[#3aaefc] to-[#4af2ff]";

  // Base site URL (adjust for local/dev if needed)
  const siteBase = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://fairblockcom.xyz";
  const permalink = `${siteBase}/history/${scope}/${encodeURIComponent(key)}`;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const r = await fetch(`/api/history/by?scope=${scope}&key=${encodeURIComponent(key)}`, {
          cache: "no-store",
        });
        const j = await r.json();
        setTopArt(j?.top_art || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [scope, key]);

  // Share link to X
  function shareOnX() {
    const text = encodeURIComponent(
      `🏆 Check out Fairblock Community Art — Top ${scope === "weekly" ? "Weekly" : "Daily"} leaderboard (${key})\n\n${permalink}`
    );
    const url = `https://twitter.com/intent/tweet?text=${text}`;
    window.open(url, "_blank");
  }

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex gap-3 flex-wrap">
          <Link href="/" className="btn">
            ⬅ Home
          </Link>
          <Link href="/gallery" className="btn">
            🖼️ Gallery
          </Link>
          <Link href="/leaderboard" className="btn">
            🏆 Leaderboard
          </Link>
          <Link href="/history" className="btn">
            🗂 All History
          </Link>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg sm:text-xl font-semibold text-[#3aaefc] whitespace-nowrap">
            {scope === "weekly" ? "Weekly" : "Daily"} Leaderboard — {key}
          </h1>
          <button
            onClick={shareOnX}
            className="btn bg-[#3aaefc]/20 hover:bg-[#3aaefc]/30 transition"
          >
            🐦 Share on X
          </button>
        </div>
      </div>

      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : topArt.length === 0 ? (
        <p className="opacity-70">No data found for this period.</p>
      ) : (
        <div className="space-y-3">
          {topArt.map((t, idx) => {
            const name = t.title ?? "Untitled";
            const owner = t.owner ?? "";
            const handleNoAt = owner.replace(/^@/, "");
            const xUrl = handleNoAt ? `https://x.com/${handleNoAt}` : "";
            const seeOnGallery = `/gallery?select=${encodeURIComponent(t.id)}`;

            return (
              <div
                key={t.id}
                className="flex items-center justify-between bg-white/5 rounded-xl p-4 sm:p-5"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="w-6 text-center opacity-70">{idx + 1}.</span>
                  {t.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.url}
                      alt={name}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover bg-white/10 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {name}{" "}
                      {owner && (
                        <>
                          <span className="opacity-70">by</span>{" "}
                          <a
                            href={xUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-[#4af2ff]"
                          >
                            {owner}
                          </a>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={seeOnGallery}
                        className={btn}
                      >
                        See on Gallery
                      </Link>
                      {t.postUrl && (
                        <a
                          href={t.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={btn}
                        >
                          Open Art Post
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <span className={badge}>{t.likes ?? 0}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
