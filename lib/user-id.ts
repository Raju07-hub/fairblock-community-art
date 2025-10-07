// dipanggil di sisi client
export function getOrCreateUserId(): string {
  try {
    let id = localStorage.getItem("fairblock_user_id");
    if (!id) {
      // lazy import supaya tree-shaking aman
      const { v4 } = require("uuid");
      id = v4();
      localStorage.setItem("fairblock_user_id", id);
    }
    return id;
  } catch {
    // fallback: 1 sesi = 1 id
    return Math.random().toString(36).slice(2);
  }
}
