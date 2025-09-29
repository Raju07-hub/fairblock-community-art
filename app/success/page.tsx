"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function SuccessPage() {
  const sp = useSearchParams();
  const id = sp.get("id") || "";
  return (
    <div className="max-w-2xl mx-auto px-4 pt-28 text-center">
      <h2 className="text-2xl font-semibold">Thanks for submitting! 🎉</h2>
      <p className="text-white/70 mt-2">Your artwork has been added to the gallery.</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link className="btn-ghost" href="/">Back Home</Link>
        <Link className="btn" href={`/gallery?id=${id}`}>View Your Art</Link>
      </div>
    </div>
  )
}
