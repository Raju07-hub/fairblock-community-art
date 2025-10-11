// app/gallery/page.tsx  (Server wrapper + Client content in one file)
import { Suspense } from "react";
import GalleryClient from "./page.client";

export const dynamic = "force-dynamic"; // hindari SSG yang bikin galat saat pakai search params

export default function Page() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-5 sm:px-6 py-10 opacity-70">Loading…</div>}>
      <GalleryClient />
    </Suspense>
  );
}
