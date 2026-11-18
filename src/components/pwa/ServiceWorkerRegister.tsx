"use client";

import { useEffect } from "react";

// Root layout'da bir marta ishga tushadi — sw.js'ni ro'yxatdan o'tkazadi. sw.js o'zi
// darhol faollashadi (skipWaiting) — shuning uchun bu yerda faqat yangi versiya nazoratni
// qo'lga olganda (controllerchange) sahifani bir marta qayta yuklash kifoya, bu yangi
// deploy'dan keyin foydalanuvchi doim eng so'nggi versiyada bo'lishini ta'minlaydi.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let refreshed = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("/sw.js").catch((e) => console.error("Service worker ro'yxatdan o'tmadi:", e));
  }, []);

  return null;
}
