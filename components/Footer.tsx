"use client";
import { useState } from "react";

export default function Footer() {
  const [showQR, setShowQR] = useState(false);
  const wallet = "0x00B8Dfd0c24173D67eff903C57875559332b2379";

  const copyAddr = async () => {
    try {
      await navigator.clipboard.writeText(wallet);
      // snack mini
      const el = document.createElement("div");
      el.textContent = "Wallet address copied!";
      el.className =
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-3 py-2 rounded-full bg-white/10 text-white text-sm ring-1 ring-white/15";
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1200);
    } catch {
      alert("Failed to copy wallet address.");
    }
  };

  return (
    // min-h supaya tinggi minimal 64px, tapi bisa auto nambah saat QR muncul
    <footer className="min-h-16 w-full bg-[#0B0D17]/95 border-t border-white/10 py-3">
      {/* 3 kolom: kiri / tengah (Tip) / kanan */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6 grid grid-cols-1 sm:grid-cols-3 items-center">
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

        {/* Tengah: tombol + QR DI BAWAH tombol */}
        <div className="order-1 sm:order-2 justify-self-center flex flex-col items-center gap-2">
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

          {showQR && (
            <div className="glass p-2 rounded-lg shadow-lg">
              {/* QR kotak & kecil: 80x80 (bisa naikkan ke w-24 h-24 kalau mau) */}
              <img
                src="/wallet-qr.png"
                alt="Wallet QR"
                className="w-20 h-20 rounded-md object-contain block"
                draggable={false}
              />
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
