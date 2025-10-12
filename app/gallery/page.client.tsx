// --- GANTI SEMUA DEFINISI TOKEN UTILS DI FILE INI MENJADI BERIKUT ---

// Coba baca token lama untuk id tertentu dari berbagai kunci/format penyimpanan
function readAnyTokenForId(id: string): string | null {
  const candidates = [
    "fairblock:tokens",          // format map { [id]: token }
    "fairblock:deleteTokens",    // kemungkinan lama
    "gallery:tokens",            // kemungkinan lama
    "fb:tokens",                 // kemungkinan lama
  ];
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      // 1) map { [id]: token }
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object" && obj[id]) {
          return String(obj[id]);
        }
      } catch {
        /* bukan JSON map, lanjut cek bentuk lain */
      }

      // 2) array [{id, token}] atau [[id, token]]
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const it of arr) {
            if (Array.isArray(it) && it[0] === id && it[1]) return String(it[1]);
            if (it && typeof it === "object" && it.id === id && it.token) return String(it.token);
          }
        }
      } catch {
        /* bukan JSON array, lanjut */
      }

      // 3) string tunggal (jarang), kalau kebetulan formatnya langsung token per id (key inklusif id)
      if (raw && raw.length >= 16 && key.includes(id)) return raw;

    } catch {
      /* ignore this key */
    }
  }
  return null;
}

// Back-compat: dipakai oleh UI untuk cek kepemilikan per-id
function getLegacyTokenFor(id: string): string | null {
  // Prioritas: kunci baru yang kita pakai sekarang
  try {
    const raw = localStorage.getItem("fairblock:tokens");
    if (raw) {
      const map = JSON.parse(raw || "{}");
      if (map && map[id]) return String(map[id]);
    }
  } catch {}

  // Coba semua kemungkinan format lama
  const t = readAnyTokenForId(id);
  if (t) return t;

  return null;
}

// Token global (beberapa versi lama menyimpan 1 token global)
function getGlobalOwnerToken(): string | null {
  try {
    return localStorage.getItem("fairblock:owner-token"); // kunci baru
  } catch { return null; }
}

// Ambil SEMUA token lokal (global + semua map lama) untuk hashing & perbandingan cepat
function getAllLocalTokens(): string[] {
  const set = new Set<string>();

  // global
  const g = getGlobalOwnerToken();
  if (g) set.add(g);

  // fairblock:tokens (map baru)
  try {
    const raw = localStorage.getItem("fairblock:tokens");
    if (raw) {
      const map = JSON.parse(raw || "{}");
      if (map && typeof map === "object") {
        for (const k of Object.keys(map)) if (map[k]) set.add(String(map[k]));
      }
    }
  } catch {}

  // kunci-kunci lama lain (map/array)
  for (const key of ["fairblock:deleteTokens", "gallery:tokens", "fb:tokens"]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      // map
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          for (const k of Object.keys(obj)) if (obj[k]) set.add(String(obj[k]));
        }
      } catch {}
      // array
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const it of arr) {
            if (Array.isArray(it) && it[1]) set.add(String(it[1]));
            if (it && typeof it === "object" && it.token) set.add(String(it.token));
          }
        }
      } catch {}
    } catch {}
  }

  return Array.from(set);
}
