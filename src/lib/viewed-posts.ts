// Ko'rilgan postlar brauzer sessiyasida (tab yopilguncha) eslab qolinadi:
// sahifaga qaytganda har bir post uchun yana "view" so'rovi yuborilmaydi (ham tezroq, ham ko'rishlar soni to'g'ri).
const KEY = "tt_viewed_posts";
const MAX = 500;

function read(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function hasViewedPost(id: string): boolean {
  return read().includes(id);
}

export function markViewedPost(id: string): void {
  try {
    const arr = read();
    if (arr.includes(id)) return;
    arr.push(id);
    sessionStorage.setItem(KEY, JSON.stringify(arr.slice(-MAX)));
  } catch {
    // Xotira to'la yoki taqiqlangan (private rejim) — jimgina o'tkazib yuboramiz
  }
}

// "Ko'rildi" — sessiyada har post uchun FAQAT BIR MARTA. Komponent qayta chizilganda, ro'yxat yangilanganda yoki scroll qilib
// qaytilganda takror yuborilmaydi (Android'da ko'rishlar shu sabab sun'iy oshgan edi). Xotiradagi to'plam — sessionStorage
// ishlamasa ham (private rejim) bitta sahifa davomida takror bo'lmasligi uchun; sessionStorage — sahifa qayta yuklansa ham.
const sentThisPage = new Set<string>();
export function trackPostView(id: string, send: (id: string) => void = (pid) => { fetch(`/api/posts/${pid}/view`, { method: "POST", keepalive: true }).catch(() => {}); }): boolean {
  if (!id || sentThisPage.has(id) || hasViewedPost(id)) return false;
  sentThisPage.add(id);
  markViewedPost(id);
  send(id);
  return true;
}

// Faqat testlar uchun
export function _resetViewedPosts(): void { sentThisPage.clear(); try { sessionStorage.removeItem(KEY); } catch { /* jimgina */ } }
