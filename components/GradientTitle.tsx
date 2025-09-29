export default function GradientTitle() {
  return (
    <div className="text-center mt-28">
      <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-tight"
          style={{textShadow: "0 6px 40px rgba(138,124,255,.35)"}}>
        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-violet-300/90">
          FAIRBLOCK COMMUNITY ART
        </span>
      </h1>
      <p className="mt-3 text-white/70 text-sm">
        By <a className="underline" href="https://x.com/0xKanjuro0">@kanjuro</a>
      </p>
      <div className="mt-5 flex items-center justify-center gap-3">
        <a href="/submit" className="btn">Submit Your Art</a>
        <a href="/gallery" className="btn-ghost">View Gallery</a>
      </div>
    </div>
  )
}
