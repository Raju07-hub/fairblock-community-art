import "./globals.css";
import type { Metadata } from "next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Fairblock Community Art",
  description: "Submit and browse community art.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="relative min-h-screen">
        {/* Background (fixed) */}
        <div className="fixed inset-0 -z-10">
          <img src="/fairblock-bg.webp" alt="bg" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/65 backdrop-blur-[6px]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        <Navbar />

        {/* main = tinggi layar - (navbar + footer) = 100vh - 8rem */}
        <main className="min-h-[calc(100vh-8rem)] pt-0">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
