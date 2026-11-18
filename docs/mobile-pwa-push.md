# Mobil (iPhone) tajriba: PWA, o'rnatish, Web Push, aniqlangan buzilishlar

## 1) Aniq topilgan va tuzatilgan buzilish
Profil sahifasida (skrinshotda ko'rsatilgan): "Trener bo'lish" tugmasi ekrandan tashqariga chiqib, kesilib qolardi. Sabab: header qatori (`flex items-start`) ichida tugma siqilmasdan, boshqa elementlar bilan birga bitta qatorga sig'dirilmoqchi bo'lgan. **Tuzatildi**: mobil ekranda tugma to'liq enlik, alohida qatorda; ≥640px (sm) ekranlarda avvalgidek yon tomonda ko'rinadi. Shuningdek trener profili sahifasidagi tugma qatorlariga (`Xabar yozish`/`Obuna bo'lish`/`...`) ehtiyot chorasi sifatida `flex-wrap` qo'shildi — juda tor ekranda kesilib qolish o'rniga qatorga tushadi.

**Diqqat**: butun saytni HAR BIR sahifada, HAR BIR ekran o'lchamida haqiqiy qurilmada ko'rmasdan 100% kafolatlab bo'lmaydi — men kodni sistematik ko'rib chiqdim va topgan aniq muammolarni tuzatdim, lekin haqiqiy iPhone'da (375/390/430px) qisqa amaliy tekshiruv tavsiya etiladi.

## 2) PWA — "Bosh ekranga qo'shish"
- `public/manifest.webmanifest`, ikonkalar (`public/icons/`: 192, 512, maskable-512 — barchasi mavjud `app-icon.png`dan, sizning haqiqiy brend rangingiz `#C7F32E` bilan mos qilib generatsiya qilindi), `apple-touch-icon.png`.
- `app/layout.tsx`: `viewport` eksporti (`viewport-fit: cover` — iPhone notch/home-indicator uchun shart), `appleWebApp` meta (status bar, standalone rejim).
- `public/sw.js`: FAQAT statik fayllarni (`/_next/static/`, `/icons/`, shriftlar) keshlaydi — API/auth/shaxsiy ma'lumotlar hech qachon keshlanmaydi. Versiyalangan (`CACHE_VERSION`) — har deploy'da eski kesh avtomatik tozalanadi, foydalanuvchi qayta ochganda yangi versiyada bo'ladi.
- `public/offline.html`: internet yo'qligida ko'rsatiladigan oddiy sahifa.
- `userScalable: false` qo'ydim (pinch-zoom o'chiq) — "haqiqiy ilova" tuyg'usi uchun odatiy amaliyot, lekin bu bir oz accessibility-trade-off ekanini bilib qo'ying (ko'rish qiyin bo'lgan foydalanuvchilar kattalashtira olmaydi). Xohlasangiz o'chirib qo'yaman.

## 3) O'rnatish bannerlari
`components/pwa/InstallBanner.tsx` — uch holat: iOS Safari ("Share → Bosh ekranga qo'shish"), iOS boshqa brauzer/Telegram ichki ("Safari'da oching"), Android ("Play Market'dan yuklab olish" — havola `ANDROID_APP_URL` konstantasi, hozircha yopiq test linkiga qo'yilgan, e'lon ochilgach shu bitta joyni almashtirasiz). Yopilsa 14 kun ko'rsatilmaydi (`localStorage`). Standalone (allaqachon o'rnatilgan) bo'lsa umuman ko'rinmaydi. Profil → Sozlamalarda doimiy "Ilova" bo'limi ham bor (`InstallMenuItem`) — bannerdan mustaqil, yopib tashlansa ham qoladi.

## 4) Push bildirishnomalar — FCM (Android) + Web Push (iOS Safari/PWA)
**Nega ikkita yo'l?** Android ilova FCM orqali ishlayveradi (o'zgarishsiz). iOS Safari (16.4+, standalone) uchun esa **standart Web Push (VAPID)** tanlandi, FCM emas — Apple WebKit buni to'g'ridan-to'g'ri, o'zi hujjatlashtirgan holda qo'llab-quvvatlaydi; Google'ning FCM Web SDK'si Safari bilan ko'p marta moslik muammolari berganligi haqida xabarlar bor. Ikkala yo'l ham BIR XIL joydan (`lib/push.ts`ning `sendPush`/`sendPushToAll`) ishga tushadi va bir xil `{title, body, route, tag}` formatini ishlatadi — `lib/push-notify.ts`dagi barcha mavjud trigger joylar (chat xabari, guruh xabari, kanal e'loni) o'zgarishsiz ikkalasiga ham yetib boradi.

### Yangi migratsiya
`migration-v28-web-push.sql` — `device_tokens`ga `web_push_keys jsonb` ustuni (platform='web' bo'lganda `token` ustuni endpoint URL'ni, `web_push_keys` esa `{p256dh, auth}` kalitlarini saqlaydi).

### Yangi env o'zgaruvchilar (VAPID)
Kalitlarni **bir marta** generatsiya qiling va Vercel'ga qo'ying (repoda saqlamang):
```
node -e "const w=require('web-push'); const k=w.generateVAPIDKeys(); console.log('PUBLIC:',k.publicKey); console.log('PRIVATE:',k.privateKey);"
```
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — ochiq kalit (frontend ham ishlatadi, shuning uchun `NEXT_PUBLIC_`)
- `VAPID_PRIVATE_KEY` — maxfiy kalit (faqat serverda)
- `VAPID_SUBJECT` — ixtiyoriy, standart `mailto:support@trainertop.uz`

Kalit yo'q bo'lsa Web Push jimgina o'chiq turadi (FCM'ga ta'sir qilmaydi, aksincha ham shunday).

### Frontend oqimi
Profil → Sozlamalar → "Bildirishnomalarni yoqish" tugmasi (`NotificationPermissionButton.tsx`) — **faqat tugma bosilganda** ruxsat so'raydi (iOS talabi). iOS'da hali "Bosh ekranga qo'shilmagan" (standalone emas) bo'lsa, tugma o'rniga shuni aytadi (iOS'da push FAQAT standalone'da ishlaydi). Ruxsat berilsa `pushManager.subscribe()` orqali obuna yaratiladi (yoki mavjudi ishlatiladi) va `POST /api/devices` ga `{token: endpoint, platform: "web", keys: {p256dh, auth}}` yuboriladi.

### Backend
`/api/devices` POST endi `platform: "web"` uchun `keys` talab qiladi (yo'q bo'lsa 400). Eskirgan/bekor qilingan obunalar (`404`/`410` javobi) avtomatik bazadan tozalanadi — xuddi FCM'dagidek.

## 5) Deploy tartibi
1. `migration-v28-web-push.sql` ishga tushiring
2. Vercel'ga `NEXT_PUBLIC_VAPID_PUBLIC_KEY` va `VAPID_PRIVATE_KEY` qo'shing (yuqoridagi buyruq bilan generatsiya qiling)
3. Kodni deploy qiling
4. (Ixtiyoriy) `components/pwa/InstallBanner.tsx`dagi `ANDROID_APP_URL`ni Play Market e'lon qilingach yangilang

## 6) Sinov natijalari
JS: **~90 ta yangi test** (PWA aniqlash, o'rnatish bannerlari, bildirishnoma tugmasi, web push yetkazish, `/api/devices` kengaytmasi, `lib/push.ts` integratsiyasi — jumladan sahifalash mantig'idagi haqiqiy xatoni ham mutatsiya yordamida topib tuzatdim). Deyarli barcha mutatsiya tutildi. `tsc` toza.
