export function ensureOwnerToken(): string {
  if (typeof window === "undefined") return "";
  let t = localStorage.getItem("fbc_owner_token");
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem("fbc_owner_token", t);
  }
  return t;
}
export function getOwnerToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("fbc_owner_token") || "";
}
