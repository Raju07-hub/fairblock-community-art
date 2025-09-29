export default function Navbar() {
  return (
    <header className="h-16 w-full bg-[#0B0D17]/95 border-b border-white/10">
      <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-5 sm:px-6">
        
        {/* kiri: logo + nama */}
        <a href="/" className="flex items-center gap-2">
          <img 
            src="/fairblock-logo.webp" 
            alt="Fairblock" 
            className="w-8 h-8 rounded-md" 
          />
          <span className="font-semibold">Fairblock</span>
        </a>

        {/* kanan: tombol */}
        <nav className="flex items-center gap-3">
          <a href="/submit" className="btn text-sm">Submit</a>
          <a href="/gallery" className="btn text-sm">Gallery</a>
        </nav>
      </div>
    </header>
  );
}
