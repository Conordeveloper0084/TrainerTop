// Post rasmlari KESILMAYDI: karta balandligi birinchi rasmning asl nisbatiga (eni / bo'yi) moslashadi,
// Instagram kabi 0.8 (4:5, bo'yi uzun) … 1.91 (1.91:1, eni uzun) oralig'ida cheklanadi; rasm "contain" bilan sig'diriladi.
// Server rasm o'lchamini bermaydi — nisbat yuklangan rasmdan olinadi va sakrashni kamaytirish uchun sessiyada eslab qolinadi.
export const MIN_RATIO = 0.8;
export const MAX_RATIO = 1.91;
export const DEFAULT_RATIO = 1;

export function clampRatio(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return DEFAULT_RATIO;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, width / height));
}

const KEY = "tt_img_ratio";
const MAX_ENTRIES = 300;
const memory = new Map<string, number>();
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : null;
    if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) if (typeof v === "number" && v >= MIN_RATIO && v <= MAX_RATIO) memory.set(k, v);
  } catch { /* sessionStorage yo'q/taqiqlangan — faqat xotira */ }
}

export function getCachedRatio(url: string | null | undefined): number | null {
  if (!url || typeof window === "undefined") return null;
  load();
  return memory.get(url) ?? null;
}

export function rememberRatio(url: string | null | undefined, ratio: number): void {
  if (!url || typeof window === "undefined" || !(ratio >= MIN_RATIO && ratio <= MAX_RATIO)) return;
  if (url.startsWith("blob:") || url.startsWith("data:")) return;      // post yaratishdagi mahalliy ko'rinish — vaqtinchalik manzil
  load();
  if (memory.get(url) === ratio) return;
  memory.set(url, ratio);
  while (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value as string);
  try { sessionStorage.setItem(KEY, JSON.stringify(Object.fromEntries(memory))); } catch { /* jimgina */ }
}

// Faqat testlar uchun
export function _resetRatioCache(): void { memory.clear(); loaded = false; }
