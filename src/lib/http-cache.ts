// Ommaviy RO'YXAT javoblari uchun CDN keshi (Vercel Edge Network).
//
// FAQAT foydalanuvchiga bog'liq BO'LMAGAN javoblarga qo'llang (hamma ko'ruvchiga bir xil). Foydalanuvchiga
// bog'liq (is_liked, bloklangan ro'yxat, o'z qoralamalari, sotib olinganlar) javobni keshlash — boshqa odamning
// ma'lumotini ko'rsatib qo'yishi mumkin, chunki Vercel keshi cookie'ni kalit sifatida ishlatmaydi.
//
// Eslatmalar (Vercel hujjati bo'yicha):
//  • `s-maxage` faqat CDN uchun; brauzer/ilovaga Vercel uni olib tashlab `public, max-age=0, must-revalidate`
//    yuboradi — ya'ni ilova tomonida avtomatik kesh BO'LMAYDI (kerak bo'lsa ilovaning o'zi saqlasin).
//  • So'rovda `Authorization` header bo'lsa Vercel keshi UMUMAN ishlamaydi — ilova ommaviy ro'yxatlarni
//    token'siz so'rashi kerak (docs/performance-latency-cdn.md).
//  • 30 s yangi + 300 s eskirgan holda ko'rsatish: yangi trener/darslik ~30 s (eng ko'pi ~5.5 daqiqa),
//    ban/olib tashlash ham shuncha kechikib ro'yxatda aks etadi (detal sahifalar `no-store`).
export const PUBLIC_LIST_CACHE_CONTROL = "s-maxage=30, stale-while-revalidate=300";

// `Server-Timing` — kechikish qayerda ketayotganini ko'rish uchun (curl -i / Safari Web Inspector):
//   db = bazaga ketgan vaqt, total = funksiyaning o'zidagi jami vaqt (tarmoq va cold start KIRMAYDI).
// Keshdan berilgan javobda bu qiymat KESHLANGAN (birinchi hisoblangan) so'rovniki bo'ladi.
export function serverTiming(startedAt: number, dbMs: number, now: number = performance.now()): string {
  const fmt = (n: number) => Math.max(0, n).toFixed(1);
  return `db;dur=${fmt(dbMs)}, total;dur=${fmt(now - startedAt)}`;
}

export function listResponseHeaders(opts: { cacheable: boolean; startedAt: number; dbMs: number }): Record<string, string> {
  const h: Record<string, string> = { "Server-Timing": serverTiming(opts.startedAt, opts.dbMs) };
  if (opts.cacheable) h["Cache-Control"] = PUBLIC_LIST_CACHE_CONTROL;
  return h;
}
