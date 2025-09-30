"use client";
import { useState } from "react";

export default function Footer() {
  const address = "0x00B8Dfd0c24173D67eff903C57875559332b2379";
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  const [copied, setCopied] = useState(false);

  async function copyAddr() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <footer className="w-full bg-[#0B0D17]/95 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-3 grid grid-cols-3 items-center">
        
        {/* left */}
        <p className="text-xs sm:text-sm text-white/70">
          Built by{" "}
          <a
            href="https://x.com/0xKanjuro0"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gradient font-medium hover:opacity-90"
          >
            @0xKanjuro0
          </a>
          . © 2025 Fairblock Community.
        </p>

        {/* center → TipMe */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1 ring-1 ring-white/10">
            <img
              src="/qr-tip.png"
              alt="Tip QR"
              className="h-8 w-8 rounded-md object-contain ring-1 ring-white/15"
            />
            <button
              onClick={copyAddr}
              className="btn text-xs px-3 py-1"
            >
              💜 Tip Me
            </button>
          </div>
          <button
            onClick={copyAddr}
            className="text-[10px] text-white/60 hover:text-white/80"
            title="Copy address"
          >
            {copied ? "Copied!" : short}
          </button>
        </div>

        {/* right */}
        <div className="flex justify-end items-center gap-5 text-xs sm:text-sm">
          <a
            href="https://x.com/0xfairblock"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/90"
          >
            Official X
          </a>
          <a
            href="https://discord.com/invite/fairblock"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/90"
          >
            Discord
          </a>
          <a
            href="https://x.com/i/communities/1951055424196845999"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/90"
          >
            Community
          </a>
        </div>
      </div>
    </footer>
  );
}
