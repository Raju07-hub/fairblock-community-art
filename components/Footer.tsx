"use client";

export default function Footer() {
  const address = "0x00B8Dfd0c24173D67eff903C57875559332b2379";

  function copyAddress() {
    navigator.clipboard.writeText(address).then(() => {
      alert("Address copied:\n" + address);
    });
  }

  return (
    <footer className="h-20 w-full bg-[#0B0D17]/95 border-t border-white/10">
      <div className="max-w-6xl mx-auto h-full px-5 sm:px-6 flex items-center justify-between">
        {/* Left */}
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

        {/* Center → Tip Me */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={copyAddress}
            className="btn-ghost px-3 py-1 text-xs"
            title="Click to copy address"
          >
            💜 Tip Me
          </button>
          <img
            src="/tipme-qr.png" // ← taruh QR code kamu di /public/tipme-qr.png
            alt="Tip QR"
            className="w-12 h-12 rounded-md"
          />
        </div>

        {/* Right */}
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
