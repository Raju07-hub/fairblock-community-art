"use client";
import { useState } from "react";

export default function Footer() {
  const [showQR, setShowQR] = useState(false);
  const wallet = "0x00B8Dfd0c24173D67eff903C57875559332b2379";

  async function copyAddr() {
    try {
      await navigator.clipboard.writeText(wallet);
      alert("Wallet address copied!");
    } catch {
      alert("Failed to copy wallet address.");
    }
  }

  return (
    <footer className="h-16 w-full bg-[#0B0D17]/95 border-t border-white/10 relative">
      <div className="max-w-6xl mx-auto h-full px-5 sm:px-6 flex items-center justify-between relative">
        {/* Left copyright */}
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

        {/* Center: Tip Me (dibuat sejajar dengan maskot karena diposisikan absolut ke tengah footer) */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-[82px] flex flex-col items-center">
          <button
            onClick={() => {
              copyAddr();
              setShowQR((v) => !v);
            }}
            className="px-4 py-2 rounded-full text-sm font-semibold transition ring-1 ring-white/10
                       bg-gradient-to-r from-purple-500 to-blue-400 text-white shadow-lg hover:brightness-105"
            title="Copy address & show QR"
          >
            💜 Tip Me
          </button>

          {/* QR: selalu dirender agar bisa transisi smooth */}
          <div
            className={`mt-3 glass p-2 rounded-lg shadow-lg backdrop-blur-md
                        transform transition-all duration-200 ease-out
                        ${showQR ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}
          >
            <img
              src="/wallet-qr.png"
              alt="Wallet QR"
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-md object-contain"
            />
          </div>
        </div>

        {/* Right links */}
        <div className="hidden sm:flex items-center gap-5 text-xs sm:text-sm">
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
