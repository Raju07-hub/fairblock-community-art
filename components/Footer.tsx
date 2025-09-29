export default function Footer() {
  return (
    <footer className="h-16 w-full bg-[#0B0D17]/95 border-t border-white/10">
      <div className="max-w-6xl mx-auto h-full px-5 sm:px-6 flex items-center justify-between">
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

        <div className="hidden sm:flex items-center gap-5 text-xs sm:text-sm">
          <a href="https://x.com/0xfairblock" target="_blank" rel="noopener noreferrer" className="hover:text-white/90">
            Official X
          </a>
          <a href="https://discord.com/invite/fairblock" target="_blank" rel="noopener noreferrer" className="hover:text-white/90">
            Discord
          </a>
          <a href="https://x.com/i/communities/1951055424196845999" target="_blank" rel="noopener noreferrer" className="hover:text-white/90">
            Community
          </a>
        </div>
      </div>
    </footer>
  );
}
