# "Video darsliklar" bo'limi + video ko'rish UX + video-bo'yicha savol-javob

## 1) "Video darsliklar" bo'limi bo'sh chiqayotgan edi — tuzatildi
**Sabab**: bu bo'lim hardcoded bo'sh holat edi — hech qanday so'rov yubormagan, sotib olgan darsliklaringiz hech qachon ko'rinmas edi.

**Tuzatish**:
- `GET /api/lessons?purchased=true` — yangi filtr. Sizning (login qilgan foydalanuvchi) to'langan xaridlaringizga mos darsliklarni qaytaradi:
  - Faqat `status='paid'` xaridlar hisobga olinadi
  - Muddati tugagan oylik obunalar chiqarib tashlanadi; muddatsiz (umrbod yoki `expires_at=NULL` oylik) — faol hisoblanadi
  - **Status cheklovi yo'q** — trener darslikni keyinroq yashirsa/o'chirsa ham (qoralamaga aylansa ham), siz kirishda davom etasiz (xuddi akkauntni o'z-o'zidan o'chirish siyosati bilan bir xil printsip)
  - Banlangan trenerning darsligi ko'rinmaydi
- Frontend (`lessons/page.tsx`) "Video darsliklar" bo'limini birinchi marta ochganingizda shu so'rovni yuboradi.

## 2) Video ko'rish — qulayroq bo'ldi
- **Avtomatik skroll**: video ro'yxatidan istalgan videoni bossangiz, pleer ko'rinishiga **avtomatik, silliq** o'tadi — qo'lda tepaga aylanishga hojat yo'q.
- **Oldingi/Keyingi dars** tugmalari — video o'ynayotganda pleer ostida chiqadi, darsliklar orasida bitta bosish bilan o'tish mumkin.
- Yon paneldagi "Darslik sizniki!" karta**si ixchamlashtirildi** — vertikal joy ancha kamaydi, sahifaning qolgan qismiga ko'proq joy qoldi.

Eslatma: siz ko'rsatgan referens sayt (mohirdev.uz) uslubidagi **to'liq "video + doimiy yon ro'yxat yonma-yon"** joylashuvi hali qilinmadi — bu kattaroq qayta qurish, vaqt yetmadi. Yuqoridagi tuzatish asosiy shikoyatni (qo'lda skroll qilish) to'liq hal qiladi; to'liq joylashuvni keyingi bosqichda qilsam bo'ladi.

## 3) Har bir videoga alohida savol-javob
- **Yangi migratsiya**: `migration-v29-video-questions.sql` — `lesson_questions.video_title` ustuni (`NULL` = umumiy darslik savoli, matn = shu aniq video haqida savol). Video sarlavhasi matn sifatida saqlanadi (tartib raqami emas) — trener videoni qayta tartiblasa/qo'shsa ham eski savollar to'g'ri videoga bog'liqligicha qoladi.
- Video o'ynayotganda, pleer ostida **"Shu video haqida savol"** bo'limi chiqadi — savol yozish formasi + shu videoga tegishli savol-javoblar ro'yxati.
- Pastdagi **"Umumiy savollar"** bo'limi endi faqat video-bog'liq bo'lmagan savollarni ko'rsatadi (takrorlanmaydi).
- `POST /api/lessons/[id]/questions` endi ixtiyoriy `video_title` qabul qiladi.

## Deploy tartibi
1. `migration-v29-video-questions.sql` ishga tushiring
2. Kodni deploy qiling (boshqa yangi env o'zgaruvchi kerak emas)

## Sinov natijalari
JS: 35 ta yangi test (`purchased=true` filtri — 10 ta, video-bo'yicha savol API — 9 ta, pastroq turlardan 12 va 4 ta mavjud testlar ham o'tdi). Mutatsiya: 12/12 tutildi. SQL: real Postgres'da tasdiqlandi, 18 ta migratsiya (v3-v29) birga xatosiz ishlaydi. `tsc` toza, production build muvaffaqiyatli.
