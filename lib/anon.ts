export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  const k = "fb_anon_id";
  let v = window.localStorage.getItem(k);
  if (!v) {
    v = crypto.randomUUID();
    window.localStorage.setItem(k, v);
  }
  return v;
}
