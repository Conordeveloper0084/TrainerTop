# v38 — savol-javob: Bearer, ruxsat, push, `is_platform`, tekshiruv SQL

## Nima o'zgardi
1. **`POST /api/lessons/{id}/questions` — Bearer qabul qilinadi** (`getApiUser`: cookie YOKI `Authorization: Bearer`). Android'dagi `401` xatosi shu edi (route faqat cookie o'qirdi).
2. **Kim yoza oladi:** faqat shu darslikning **faol xaridori** yoki **treneri**; aks holda `403 "Savol berish uchun darslikni sotib oling"`. Ban qilinganlar yoza olmaydi (`getApiUser` ularni "kirmagan" deb hisoblaydi → `401`). Savol **≤ 1000 belgi** (`400`). Mavjud bo'lmagan darslik endi `404` (avval `500`). **JSON formatlari o'zgarmagan.**
   "Faol xarid" = `purchases.status='paid'` va (umrbod yoki muddati tugamagan oylik; `expires_at` yo'q oylik — faol) — darslik ro'yxati (`?purchased=true`) va detali (`is_purchased`) bilan bir xil qoida (`lib/lesson-access.ts`).
3. **Push (mavjud `sendPush` orqali):** yangi savol → trenerga (`"Darsligingizga yangi savol"`), trener BIRINCHI marta javob berdi → savol egasiga (`"Savolingizga javob berildi"`). `route = tag = lesson/<lessonId>`. Yuboruvchining o'ziga, ban qilinganlarga va o'zaro bloklanganlarga yuborilmaydi.
4. **Website:** savol formasi faqat darslikka kirishi borlarga ko'rinadi (boshqalarga "Savol berish uchun darslikni sotib oling"); kiritish maydoni 1000 belgi bilan cheklangan.
5. **`lessons.is_platform` migratsiyasi** (`migration-v30-lessons-is-platform.sql`, `ADD COLUMN IF NOT EXISTS`) repoga qo'shildi. Production'da ustun bor bo'lsa — hech narsa o'zgarmaydi (turi/NULL/default saqlanadi).
6. **Tekshiruv SQL:** `supabase/verify-v28-v30.sql` — faqat o'qiydi, v28/v29/v30 bajarilganini ko'rsatadi.

## Yo'l-yo'lakay topilgan va tuzatilgan 2 ta kamchilik (oldingi ishimdan)
- **Web Push bosilganda noto'g'ri sahifa:** service worker push `route`ni (`chat/<id>` kabi qisqa ilova-uslubidagi qiymat) to'g'ridan-to'g'ri URL qilib ochardi, saytda esa `/chat/<id>` sahifasi yo'q (404). Endi `public/sw.js` `route`ni sayt manziliga o'giradi, chat sahifasi esa yangi `?dm=<suhbat id>` havolasini ochadi (`lib/chat-deeplink.ts`).
- **`isPushConfigured()` faqat FCM'ni tekshirardi:** Web Push yolg'iz sozlangan muhitda hech bir trigger ishlamasdi. Endi FCM YOKI Web Push sozlangan bo'lsa ishlaydi.

## DEPLOY TARTIBI

**1) SQL (kod deploy'dan OLDIN).** Supabase → SQL Editor:
   1. `supabase/verify-v28-v30.sql` ni ishga tushiring. Oxirgi qator `XULOSA` — `HAMMASI OK` bo'lsa, SQL qadamlarini o'tkazib yuboring.
   2. `YETISHMAYDI` bo'lsa, `tafsilot` ustunida yetishmayotgan migratsiyalar yoziladi. Ularni **shu tartibda** ishga tushiring (hammasi qayta ishga tushirsa xavfsiz — `IF NOT EXISTS`):
      - `v25` (faqat "device_tokens jadvali" YO'Q bo'lsa) → `migration-v25-device-tokens.sql`
      - `v28` → `migration-v28-web-push.sql`
      - `v29` → `migration-v29-video-questions.sql`
      - `v30` → `migration-v30-lessons-is-platform.sql` (ustun bor bo'lsa — hech narsa qilmaydi)
   3. `verify-v28-v30.sql` ni qayta ishga tushirib, `HAMMASI OK` ni tasdiqlang.
   > Nega SQL oldin: v28 bo'lmasa `POST /api/devices` (Android ham) va push yuborish, v29 bo'lmasa savol yuborish `500` beradi.

**2) Env.** Yangi o'zgaruvchi YO'Q. (Push uchun mavjud `FIREBASE_SERVICE_ACCOUNT_JSON` va/yoki `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` kifoya.)

**3) Kod** — ZIP'ni deploy qiling.

**4) Deploy'dan keyin tekshiruv (qo'lda, ~5 daqiqa):**
   - Android'dan (Bearer) darslikni sotib olgan akkaunt bilan savol yuboring → `200`. Sotib olmagan akkaunt bilan → `403` va xabar.
   - Ikkinchi qurilmada trener akkauntida push kelganini va bosilganda darslik ochilishini ko'ring (ilovalar `lesson/<id>` ni qo'llab-quvvatlagandan keyin; qo'llamaguncha push keladi, lekin ekranga o'tmasligi mumkin).
   - Trener javob bergach, savol egasiga push kelishini ko'ring (birinchi javob).

## Ilovalarga ta'siri (qisqa)
| Endpoint / o'zgarish | Android | iOS |
|---|---|---|
| `POST /api/lessons/{id}/questions`: Bearer endi ishlaydi; yangi `403`/`400`(>1000)/`404` | **Ha** — qayta sinash, `403` matnini ko'rsatish, 1000 belgi limiti, sotib olmaganga formani yashirish | **Ha** — xuddi shunday (agar savol funksiyasi bo'lsa) |
| Push `route = lesson/<lessonId>` | **Ha** — darslik ekranini ochish | **Ha** — xuddi shunday |
| `PATCH .../questions/{id}` | Yo'q (faqat push) | Yo'q (faqat push) |
| `GET .../questions` | Yo'q | Yo'q |
| `lessons.is_platform` migratsiyasi, tekshiruv SQL, web SW/chat havolasi | Yo'q | Yo'q |

To'liq format va xato jadvallari: `docs/android-sync.md` (1.3, 1.4, 1.8). Barqaror video kalit taklifi: `docs/android-sync.md` §6 (amalga oshirilmagan).

## Sinov natijalari
JS: 6 ta yangi test fayli — savol `POST` 29, javob `PATCH` 7, push-notify 13, `isPushConfigured` 4, service worker 11, chat havolasi 8 (jami 72 yangi test; to'liq to'plam 94/94, `tsc` toza). Mutatsiya: **69 ta mutantdan 69 tasi tutildi** (2 tasi dastlab omon qolgan edi — `select` ustun ro'yxati [mock ustun nomlarini ko'rmaydi] va sarlavhadagi ortiqcha bo'shliqlar — tegishli testlar qo'shilgach tutildi). SQL (real Postgres 16, v3→v30 zanjiri): tekshiruv so'rovi 4 holatda tekshirildi (v27 / to'liq / faqat v28 / production'dagidek nullable `is_platform`); migratsiyalar qayta ishga tushirilganda xatosiz; `protect_lessons` triggeri oddiy foydalanuvchining `is_platform=true` qo'yishini hamon bloklaydi.

**TekshirilMAGAN (qo'lda sinash kerak):** real Android/iOS qurilmada Bearer bilan savol yuborish va push bosilishi; chat sahifasining `?dm=` havolasi brauzerda (faqat havola tanlash mantig'i testlangan, sahifa render qilinmagan); service worker haqiqiy brauzerda (mantiq soxta `self` bilan testlangan).
