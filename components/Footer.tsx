"use client";
import { useEffect, useState } from "react";

export default function Footer() {
  const [showQR, setShowQR] = useState(false);
  const wallet = "0x00B8Dfd0c24173D67eff903C57875559332b2379";

  // biar ada padding aman di iPhone (safe-area)
  useEffect(() => {
    const inset = Number(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--sat") // fallback custom
        .replace("px", "") || 0
    );
  }, []);

  async function copyAddr() {
    try {
      await navigator.clipboard.writeText(wallet);
      alert("Wallet address copied!");
    } catch {
      alert("Failed to copy wallet address.");
    }
  }

  return (
    <footer className="bg-[#0B0D17]/95 border-t border-white/10 relative">
      {/* Baris footer: kiri = credit, tengah = Tip, kanan = links
          Mobile: kolom, Tip di tengah. Desktop: sejajar */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-3 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* left */}
        <p className="text-xs sm:text-sm text-white/70 text-center md:text-left order-2 md:order-1">
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

        {/* center (selalu di tengah, mobile dan desktop) */}
        <div className="order-1 md:order-2 flex flex-col items-center justify-center w-full md:w-auto">
          <button
            onClick={async () => {
              await copyAddr();
              setShowQR((v) => !v);
            }}
            className="px-4 py-2 rounded-full text-sm font-semibold transition ring-1 ring-white/10
                       bg-gradient-to-r from-purple-500 to-blue-400 text-white shadow-lg"
          >
            💜 Tip Me
          </button>

          {/* QR kecil hanya tampil di md+ supaya mobile tetap bersih */}
          {showQR && (
            <div className="hidden md:block mt-2 glass p-2 rounded-lg shadow-lg">
              <img src="/wallet-qr.png" alt="Wallet QR" className="w-20 h-20" />
            </div>
          )}
        </div>

        {/* right */}
        <div className="order-3 md:order-3 hidden sm:flex items-center gap-5 text-xs sm:text-sm">
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
