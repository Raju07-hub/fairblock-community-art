"use client";
import Link from "next/link";

export default function HomePage() {
  return (
    // Hero mengisi seluruh tinggi main
    <section
      className="
        min-h-[calc(100vh-8rem)]
        flex flex-col items-center justify-start
        px-5 sm:px-6
        pt-4 sm:pt-5    /* kecilkan supaya naik */
      "
    >
      <div className="w-full max-w-5xl mx-auto text-center">
        {/* Judul */}
        <h1
          className="
            text-gradient
            font-extrabold tracking-tight
            text-3xl sm:text-4xl md:text-6xl lg:text-7xl
            leading-[0.9]
            drop-shadow-[0_6px_30px_rgba(25,195,255,.25)]
          "
        >
          FAIRBLOCK COMMUNITY ART
        </h1>

        {/* By */}
        <p className="mt-2 text-sm sm:text-base text-white/70">
          By{" "}
          <a
            href="https://x.com/0xKanjuro0"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            @0xKanjuro0
          </a>
        </p>

        {/* Tombol */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/submit" className="btn w-full sm:w-auto text-base">
            Submit Your Art
          </Link>
          <Link href="/gallery" className="btn w-full sm:w-auto text-base">
            View Gallery
          </Link>
        </div>

        {/* Maskot */}
        <div className="mt-5 inline-flex rounded-2xl p-2 glass animate-float animate-glow">
          <img
            src="/mascot.webp"
            alt="Fairblock Mascot"
            className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 object-contain rounded-xl"
          />
        </div>
      </div>
    </section>
  );
}
