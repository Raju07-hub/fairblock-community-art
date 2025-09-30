// components/Footer.tsx
"use client";

export default function Footer() {
  // alamat asli
  const addr = "0x00B8Dfd0c24173D67eff903C57875559332b2379";

  async function copyAddr() {
    try {
      await navigator.clipboard.writeText(addr);
      alert("Address copied: " + addr);
    } catch {
      alert("Failed to copy address");
    }
  }

  return (
    <footer className="h-20 w-full bg-[#0B0D17]/95 border-t border-white/10">
      <div className="max-w-6xl mx-auto h-full px-5 sm:px-6 flex items-center justify-between">
        
        {/* Left text */}
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

        {/* Center Tip Me */}
        <div className="footer-tip mx-auto">
          <img src="/qr-tip.png" alt="Tip QR" />
          <div className="flex flex-col">
            <button onClick={copyAddr} className="btn-ghost text-xs px-3 py-1">
              💜 Tip Me
            </button>
            <span
              className="addr cursor-pointer"
              onClick={copyAddr}
              title={addr}
            >
              {addr.slice(0, 6)}...{addr.slice(-4)}
            </span>
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
