// Ochiq yo'naltirish (open redirect) himoyasi.
// Faqat shu saytning ichki yo'li ("/lessons/abc") qabul qilinadi.
// "https://evil.com", "//evil.com", "/\evil.com", "@evil.com" kabilar fallback'ga aylanadi.
export function safeRedirect(target: string | null | undefined, fallback: string = "/"): string {
  if (!target) return fallback;
  const t = target.trim();
  if (!t.startsWith("/")) return fallback;
  if (t.startsWith("//") || t.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(t)) return fallback;
  return t;
}
