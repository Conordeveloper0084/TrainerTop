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
