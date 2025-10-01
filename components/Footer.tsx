"use client";
import { useState } from "react";

export default function Footer() {
  const [showQR, setShowQR] = useState(false);
  const wallet = "0x00B8Dfd0c24173D67eff903C57875559332b2379";

  const copyAddr = async () => {
    try {
      await navigator.clipboard.writeText(wallet);
      // snackbar sederhana:
      const el = document.createElement("div");
      el.textContent = "Wallet address copied!";
      el.className =
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-3 py-2 rounded-full bg-white/10 text-white text-sm ring-1 ring-white/15";
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1400);
    } catch {
      alert("Failed to copy wallet address.");
    }
  };

  return (
    <footer className="h-16 w-full bg-[#0B0D17]/95 border-t border-white/10">
      {/* Grid 3 kolom: kiri (credit), tengah (Tip), kanan (links) */}
      <div className="max-w-6xl mx-auto h-full px-5 sm:px-6 grid grid-cols-1 sm:grid-cols-3 items-center">
        {/* Kiri */}
        <p className="text-xs sm:text-sm text-white/70 order-2 sm:order-1 justify-self-start mt-2 sm:mt-0">
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

        {/* Tengah (selalu center → sejajar dengan mascot yang center) */}
        <div className="order-1 sm:order-2 justify-self-center relative">
          <button
            onClick={() => {
              copyAddr();
              setShowQR((s) => !s);
            }}
            className="px-4 py-2 rounded-full text-sm font-semibold transition ring-1 ring-white/10
                       bg-gradient-to-r from-purple-500 to-blue-400 text-white shadow-lg"
          >
            💜 Tip Me
          </button>

          {/* QR muncul di atas tombol, tetap di dalam footer */}
          {showQR && (
            <div className="absolute -top-36 left-1/2 -translate-x-1/2 glass p-2 rounded-lg shadow-lg">
              <img src="/wallet-qr.png" alt="Wallet QR" className="w-28 h-28" />
            </div>
          )}
        </div>

        {/* Kanan */}
        <div className="order-3 justify-self-end hidden sm:flex items-center gap-5 text-xs sm:text-sm">
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
