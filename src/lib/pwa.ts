// PWA/qurilma aniqlash yordamchilari — o'rnatish bannerlari va push obunasi shular asosida qaror qabul qiladi.

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ "Mac" sifatida ko'rinadi (Desktop-class Safari) — teginish nuqtalari bilan ajratiladi.
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/.test(navigator.userAgent);
}

// iOS'da "Bosh ekranga qo'shish" FAQAT haqiqiy Safari'dan ishlaydi — Chrome/Firefox/Telegram
// va boshqa ilova-ichi brauzerlardan ishlamaydi (Apple cheklovi). Shularni UA orqali ajratamiz.
export function isIOSSafari(): boolean {
  if (!isIOS() || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA\//.test(ua);
  const isInAppBrowser = /Telegram|FBAN|FBAV|Instagram|Line\//.test(ua) || !!(window as any).TelegramWebviewProxy;
  return !isOtherBrowser && !isInAppBrowser;
}

export function isIOSInAppOrOtherBrowser(): boolean {
  return isIOS() && !isIOSSafari();
}

// VAPID public key (base64url) → Uint8Array — pushManager.subscribe() shu formatni talab qiladi.
export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Hozircha Play Market'da yopiq test — e'lon ochilgach shu havolani almashtiring.
export const ANDROID_APP_URL = "https://play.google.com/store/apps/details?id=uz.trainertop";
