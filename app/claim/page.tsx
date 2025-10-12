"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TokenMap = Record<string, string>;

function mergeTokenMaps(oldMap: TokenMap, addMap: TokenMap) {
  const next: TokenMap = { ...(oldMap || {}) };
  for (const [k, v] of Object.entries(addMap || {})) {
    if (typeof v === "string" && v.trim()) next[k] = v.trim();
  }
  return next;
}

export default function ClaimPage() {
  const [input, setInput] = useState("");
  const [previewKeys, setPreviewKeys] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const obj = JSON.parse(input || "{}");
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        setPreviewKeys(Object.keys(obj));
      } else {
        setPreviewKeys([]);
      }
    } catch {
      setPreviewKeys([]);
    }
  }, [input]);

  function importJson() {
    try {
      const incoming = JSON.parse(input || "{}");
      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
        setMessage("❌ Invalid JSON map.");
        return;
      }
      let current: TokenMap = {};
      try {
        const raw = localStorage.getItem("fairblock:tokens");
        if (raw) current = JSON.parse(raw);
      } catch {}
      const merged = mergeTokenMaps(current, incoming);
      localStorage.setItem("fairblock:tokens", JSON.stringify(merged));
      setMessage(`✅ Imported ${Object.keys(incoming).length} token(s). Total now: ${Object.keys(merged).length}.`);
    } catch (e: any) {
      setMessage(e?.message || "Failed to import JSON.");
    }
  }

  function clearAll() {
    try {
      localStorage.removeItem("fairblock:tokens");
      setMessage("🗑 Cleared fairblock:tokens.");
    } catch (e: any) {
      setMessage(e?.message || "Failed to clear.");
    }
  }

  function exportNow() {
    try {
      const raw = localStorage.getItem("fairblock:tokens") || "{}";
      navigator.clipboard.writeText(raw);
      setMessage("📋 Exported to clipboard.");
    } catch (e: any) {
      setMessage(e?.message || "Failed to export.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10">
      <div className="mb-5 flex gap-3">
        <Link href="/" className="btn">⬅ Back Home</Link>
        <Link href="/gallery" className="btn">🏞️ Gallery</Link>
      </div>

      <h1 className="text-2xl font-bold mb-3">🔑 Import Owner Tokens</h1>
      <p className="opacity-80 mb-6">
        Gunakan halaman ini untuk memindahkan token kepemilikan dari domain lama ke domain ini.
      </p>

      <ol className="list-decimal ml-5 space-y-2 mb-6 opacity-90">
        <li>
          Buka <b>domain lama</b> (misal: <code>fairblock-community-art.vercel.app</code>) dan jalankan script berikut di
          DevTools Console untuk menyalin token kamu:
        </li>
      </ol>

      <pre className="bg-black/30 rounded-lg p-3 text-sm overflow-auto mb-6">
{`(function(){
  const keys = ["fairblock:tokens","fairblock:deleteTokens","gallery:tokens","fb:tokens"];
  const out = {};
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        if (Array.isArray(obj)) {
          for (const it of obj) {
            if (Array.isArray(it) && it[0] && it[1]) out[it[0]] = it[1];
            if (it && typeof it === "object" && it.id && it.token) out[it.id] = it.token;
          }
        } else {
          for (const [id, t] of Object.entries(obj)) out[id] = t;
        }
      }
    } catch {}
  }
  const txt = JSON.stringify(out);
  console.log("Exported tokens:", txt);
  navigator.clipboard.writeText(txt);
})();`}
      </pre>

      <ol className="list-decimal ml-5 space-y-2 mb-6 opacity-90" start={2}>
        <li>Pindah ke domain baru ini (<b>fairblockcom.xyz</b>), paste JSON ke bawah, lalu klik <b>Import</b>.</li>
      </ol>

      <textarea
        className="w-full min-h-44 rounded-xl bg-white/10 p-3 outline-none"
        placeholder='Paste JSON token di sini... contoh: {"abc":"token"}'
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <div className="mt-3 text-sm opacity-80">
        Preview: {previewKeys.length ? previewKeys.join(", ") : "(none)"}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn" onClick={importJson}>📥 Import</button>
        <button className="btn" onClick={exportNow}>📤 Export</button>
        <button className="btn bg-red-500/30" onClick={clearAll}>🗑 Clear</button>
      </div>

      {message && <div className="mt-4 p-3 rounded-lg bg-white/10">{message}</div>}
    </div>
  );
}
