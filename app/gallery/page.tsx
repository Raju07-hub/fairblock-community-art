// app/gallery/page.tsx
import { Suspense } from "react";
import GalleryClient from "./page.client";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-5 sm:px-6 py-10 opacity-70">Loading…</div>}>
      <GalleryClient />
    </Suspense>
  );
}
