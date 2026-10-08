// TrainerTop service worker — FAQAT statik fayllarni (JS/CSS/shrift/ikonka) keshlaydi.
// API so'rovlari, autentifikatsiya, to'lov va shaxsiy ma'lumotlar HECH QACHON keshlanmaydi —
// ular har doim to'g'ridan-to'g'ri tarmoqqa boradi (quyidagi fetch handler buni ta'minlaydi).
//
// VERSIYALASH: har bir deploy'da CACHE_VERSION'ni oshiring (yoki build vaqtida avtomatik
// qo'yiladigan build ID bilan almashtiring) — shunda eski kesh avtomatik bekor qilinadi va
// foydalanuvchi yangi versiyani oladi (eski kesh "muammo qilmaydi").
const CACHE_VERSION = "v1";
const CACHE_NAME = `trainertop-static-${CACHE_VERSION}`;

// Qaysi so'rovlar keshlansa bo'ladi: Next.js'ning o'zi hash qo'shib chiqaradigan statik
// fayllar (/_next/static/...) va bizning ikonka/shriftlarimiz — bular IMMUTABLE (hech qachon
// o'zgarmaydi, nomi o'zgaradi), shuning uchun keshlash xavfsiz.
function isCacheableStatic(url) {
  return url.origin === self.location.origin && (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(?:woff2?|ttf|otf)$/.test(url.pathname)
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith("trainertop-static-") && n !== CACHE_NAME).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;   // POST/PUT/DELETE (barcha API yozish amallari) — tegilmaydi
  const url = new URL(req.url);

  if (isCacheableStatic(url)) {
    // Cache-first: hash'langan statik fayl birinchi marta kelganda saqlanadi, keyingi safar
    // tarmoqqa chiqmasdan to'g'ridan-to'g'ri keshdan beriladi.
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) { const cache = await caches.open(CACHE_NAME); cache.put(req, res.clone()); }
        return res;
      } catch (e) {
        return cached || Response.error();
      }
    })());
    return;
  }

  if (req.mode === "navigate") {
    // Sahifa so'rovlari: HAR DOIM tarmoqdan (API/auth bilan bir xil printsip — shaxsiy/yangi
    // kontent keshdan emas, to'g'ridan-to'g'ri serverdan kelsin). Internet yo'q bo'lsagina
    // oddiy offline sahifa ko'rsatiladi.
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  // Qolgan hammasi (API, rasm/video CDN, boshqa domenlar) — doim tarmoqqa, hech qachon keshlanmaydi.
});

// ---------------------------------------------------------------------------
// PUSH BILDIRISHNOMALAR (iOS 16.4+ standalone PWA va boshqa Web Push qo'llab-quvvatlovchi
// brauzerlar). Payload shakli Android ilovadagi FCM xabarlari bilan BIR XIL: {title, body,
// route, tag} — shuning uchun backend ikkalasiga ham bitta joydan, bir xil ma'noda yuboradi.
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || "TrainerTop";
  const body = data.body || "";
  const route = data.route || "/";
  const tag = data.tag || "trainertop";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { route },
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = (event.notification.data && event.notification.data.route) || "/";
  const targetUrl = new URL(route, self.location.origin).href;

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        client.focus();
        if ("navigate" in client) client.navigate(targetUrl);
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});
