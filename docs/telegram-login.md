# Telegram orqali kirish (bot orqali) — sayt, Android, iOS uchun umumiy (v46)

SMS o'rniga tekin yo'l. Email + parol, Google va Apple kirishlari **o'zgarmagan** (tekshiruvchilar demo akkaunt bilan email orqali kiradi). Telegram — asosiy, birinchi tugma.

> **Holat:** kod va testlar tayyor; **haqiqiy Supabase Auth va haqiqiy Telegram bilan jonli sinalmagan** (sandbox'dan ulanib bo'lmaydi). Deploy'dan keyin pastdagi "Jonli sinov" bo'limini bajaring.

---
## 1. Oqim

```
Mijoz                      Server                         Telegram (login bot)             Foydalanuvchi
 │ POST /start {platform} ─▶│ login_id + poll_secret yaratadi
 │◀─ {login_id, poll_secret,│ (bazada faqat poll_secret HASH'i)
 │    bot_url, tg_url, ...} │
 │ tg_url / QR ochadi ──────────────────────────────────────────▶ /start login_<login_id> ─▶ bot
 │                          │◀── webhook ────────────────────────  "Siz hozir TrainerTop'ga (Android)
 │                          │    tasdiq so'raydi (sessiya YO'Q)     kiryapsiz. Agar bu siz bo'lmasangiz,
 │                          │                                       bosmang."  [✅ Tasdiqlash][❌ Bekor]
 │                          │◀── webhook (✅ bosildi) ─────────── foydalanuvchi tugmani bosadi
 │                          │ akkaunt topiladi/yaratiladi, so'rov "confirmed"
 │ GET /status (har 2 s) ──▶│ pending ... pending
 │◀─ {status:"confirmed",   │ so'rov atomik "consumed" bo'ladi, sessiya shu paytda yaratiladi
 │    access_token, ...}    │ (qayta berilmaydi)
```

**Muhim qoida:** `/start` o'zi HECH QACHON sessiya bermaydi va akkaunt yaratmaydi — faqat **tasdiq tugmasi**. Sessiya tokenlari bazaga yozilmaydi: tasdiqlashda faqat "kim" saqlanadi, tokenlar mijoz sirni (`poll_secret`) ko'rsatib so'raganda yaratiladi.

---
## 2. Deploy tartibi

1. **SQL** (Supabase → SQL Editor): `supabase/migration-v33-telegram-login.sql`. Oxirgi qatorda `natija = OK` chiqishi kerak. *(Agar `migration-v31` va `migration-v32` hali ishga tushirilmagan bo'lsa — ular birinchi.)*
2. **Bot:** @BotFather'da alohida login botini yarating (support botdan **boshqa**). Tokenini va username'ini oling. Qo'shimcha sozlama shart emas (faqat shaxsiy suhbatlar ishlatiladi).
3. **Vercel env** (Production):
   | O'zgaruvchi | Qiymat |
   |---|---|
   | `TELEGRAM_LOGIN_BOT_TOKEN` | BotFather bergan token |
   | `TELEGRAM_LOGIN_BOT_USERNAME` | bot username'i (`@`siz yoki `@` bilan) |
   | `TELEGRAM_LOGIN_WEBHOOK_SECRET` | `openssl rand -hex 32` (faqat `A-Z a-z 0-9 _ -`) |
   Boshqa yangi env yo'q (Supabase kalitlari allaqachon bor).
4. **Kodni deploy qiling** (yangi paket: `qrcode` — `package.json`/lock yangilangan).
5. **Webhook'ni ulang** (deploy'dan KEYIN):
   ```
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d url=https://www.trainertop.uz/api/auth/telegram/webhook \
     -d secret_token=<TELEGRAM_LOGIN_WEBHOOK_SECRET> \
     -d 'allowed_updates=["message","callback_query"]' \
     -d drop_pending_updates=true
   ```
   Tekshirish: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"` — `url` to'g'ri, `last_error_message` yo'q.
6. **Env o'zgarsa Vercel'da Redeploy** qiling.

### Jonli sinov (deploy'dan keyin, 5 daqiqa)
1. Saytda `/login` → "Telegram orqali kirish" → telefonda Telegram ochilsin → `Start` → tasdiq matni va ikki tugma chiqsin → ✅ bosing → "Tayyor" → sayt o'zi kirsin.
2. **Sessiya yaratilishini tekshirish eng muhim:** agar sayt "Sessiya yaratib bo'lmadi" desa — Vercel loglarida `Telegram sessiya:` qatoriga qarang. Sabab odatda Supabase Auth'ning `generateLink`/`verifyOtp` chaqiruvi (versiya/sozlama farqi) yoki IP bo'yicha tezlik limiti.
3. Xuddi shu Telegram bilan ikkinchi marta kiring — yangi akkaunt OCHILMASIN (`is_new_user: false`).
4. Tasdiqsiz tekshiruv: havolani ochib `Start` bosing, tugmani BOSMANG — sayt kirmasligi kerak.
5. Profilda email o'rniga "Telegram orqali kirgan" ko'rinishi kerak.

---
## 3. API (ilovalar uchun aniq formatlar)

Ikkala endpoint ham **loginsiz** (`Authorization` header shart emas). Barcha javoblar `Cache-Control: no-store`.

### 3.1 `POST /api/auth/telegram/start`
**So'rov** (`Content-Type: application/json`):
```json
{ "platform": "android", "device_id": "3f1c…-android" }
```
- `platform`: `"android"` | `"ios"` | `"web"` (majburiy).
- `device_id`: ixtiyoriy, barqaror tasodifiy qiymat (8–128 belgi, `A-Za-z0-9._:-`); tezlik limiti uchun. Qurilmada bir marta yaratib saqlang.

**Javob 200:**
```json
{
  "login_id": "5d2f0c1e-1111-4222-8333-444455556666",
  "poll_secret": "bK3x…43 belgi…",
  "expires_at": "2026-11-06T17:30:00.123456+00:00",
  "expires_in": 300,
  "poll_interval_ms": 2000,
  "bot_url": "https://t.me/<bot>?start=login_5d2f0c1e-…",
  "tg_url":  "tg://resolve?domain=<bot>&start=login_5d2f0c1e-…"
}
```
- `poll_secret` **faqat shu javobda** qaytadi, havolalarda YO'Q. Uni faqat xotirada saqlang (diskka/logga yozmang).
- Muddat 5 daqiqa, so'rov bir martalik.

**Xatolar:**
| HTTP | `code` | Ma'nosi | Mijoz nima qilsin |
|---|---|---|---|
| 400 | `BAD_PLATFORM` | `platform` yo'q/noto'g'ri | kodni tuzating |
| 429 | `RATE_LIMITED` | juda ko'p urinish (+`Retry-After: 60`, `retry_after`) | "Bir necha daqiqadan keyin urinib ko'ring" |
| 503 | `TELEGRAM_NOT_CONFIGURED` | server hali sozlanmagan | "Hozircha mavjud emas, email bilan kiring" |
| 500 | `SERVER_ERROR` | server xatosi | qayta urinish tugmasi |

**Tezlik limiti:** bir IP — 10 ta start / 10 daqiqa; bir `device_id` — 5 ta / 10 daqiqa.

### 3.2 `GET /api/auth/telegram/status?login_id=<uuid>&poll_secret=<43 belgi>`
**Javoblar:**
| HTTP | Tana | Ma'nosi | Mijoz nima qilsin |
|---|---|---|---|
| 200 | `{"status":"pending"}` | hali tasdiqlanmagan | `poll_interval_ms` dan keyin yana so'rang |
| 200 | `{"status":"expired"}` | muddat tugadi | "Vaqt tugadi" + qayta boshlash |
| 200 | `{"status":"cancelled"}` | botda "Bekor qilish" bosildi | "Bekor qilindi" |
| 200 | `{"status":"consumed"}` | sessiya allaqachon olingan | polling'ni to'xtating; agar tokenni olmagan bo'lsangiz — qayta boshlang |
| 200 | **tasdiqlangan** (pastda) | **FAQAT BIR MARTA** | sessiyani import qiling, polling'ni to'xtating |
| 400 | `{"code":"BAD_REQUEST"}` | parametr shakli noto'g'ri | kodni tuzating |
| 404 | `{"code":"NOT_FOUND"}` | `login_id` yo'q **yoki** `poll_secret` noto'g'ri (farqlanmaydi) | to'xtating, qayta boshlang |
| 403 | `{"code":"ACCOUNT_BANNED","message":"…"}` | akkaunt bloklangan | xabarni ko'rsating; qayta urinish YO'Q |
| 503 | `{"code":"SESSION_FAILED","retry":true}` | sessiya vaqtincha yaratilmadi; so'rov qayta olinadigan holatga qaytarildi | **yana so'rang** (eng ko'pi 3 marta), keyin xato |
| 500 | `{"code":"SERVER_ERROR"}` | server xatosi | xato ko'rsating |

**Tasdiqlangan javob (200):**
```json
{
  "status": "confirmed",
  "access_token": "eyJ…", "refresh_token": "…",
  "expires_in": 3600, "expires_at": 1793900000, "token_type": "bearer",
  "user": { "id": "…", "full_name": "Ali Valiyev", "username": "ali_v", "avatar_url": null, "role": "user" },
  "is_new_user": true
}
```
- `user` da email YO'Q (sintetik, ko'rsatilmaydi). `is_new_user: true` bo'lsa onboarding ko'rsatish mumkin. `avatar_url` yangi foydalanuvchida dastlab `null` bo'lishi mumkin (Telegram rasmi fonda yuklanadi).
- `expires_at` — Unix sekund.

### 3.3 Polling qoidalari
1. `start` javobidan keyin `poll_interval_ms` (2 s) kutib birinchi so'rov; so'rovlar **ketma-ket** (oldingisi tugamay yangisi yuborilmasin).
2. Terminal holatlarda (`confirmed`, `expired`, `cancelled`, `consumed`, 400/403/404) **to'xtang**.
3. `expires_at` dan 5 soniya o'tgach server javobini kutmasdan "Vaqt tugadi" deng.
4. Tarmoq xatosi — davom eting; **ketma-ket 5 ta** xatodan keyin to'xtang. `503 SESSION_FAILED` — eng ko'pi 3 marta.
5. Foydalanuvchi bekor qilsa yoki ekrandan chiqsa — polling'ni to'xtating (serverda "bekor qilish" endpointi yo'q; so'rov o'zi eskiradi).
6. Bir `start` — bir polling sikli. Qayta urinish = yangi `start` (yangi `login_id` va `poll_secret`).

### 3.4 Sessiyani import qilish
Server standart Supabase sessiyasini beradi (**access + refresh token**) — SDK odatdagidek yangilaydi, mavjud API'lar o'zgarmagan (`Authorization: Bearer <access_token>`).
- **Sayt:** `supabase.auth.setSession({ access_token, refresh_token })` (tayyor: `components/auth/TelegramLoginButton.tsx`).
- **iOS (supabase-swift):** `try await supabase.auth.setSession(accessToken:refreshToken:)`.
- **Android (supabase-kt):** `UserSession(...)` ni `auth.importSession(...)` bilan import qiling.
  *(SDK versiyangizga qarab metod nomi biroz farq qilishi mumkin — o'zingizning versiyangiz hujjatini tekshiring.)*
- Import'dan keyin odatdagidek `GET /api/profile` ni chaqiring. Telegram foydalanuvchisida: `email: null`, `login_provider: "telegram"` (email bilan kirganlarda `"email"`).

---
## 4. Android / iOS uchun eslatmalar
- **Telegram'ni ochish:** avval `tg_url` (to'g'ridan-to'g'ri Telegram ilovasi); ochilmasa (o'rnatilmagan) — `bot_url` (brauzerda t.me sahifasi). QR kerak emas (ilova o'zi Telegram'ni ochadi).
  - *iOS:* `canOpenURL("tg://")` uchun `Info.plist` dagi `LSApplicationQueriesSchemes` ga `tg` qo'shing.
  - *Android 11+:* paket ko'rinishini tekshirsangiz `<queries>` ga Telegram paketlarini qo'shing; oddiy `ACTION_VIEW` + `tg_url` bilan ochish uchun shart emas.
- **Ilova fonga o'tganda** (Telegram'ga ketganda) polling to'xtab qolishi mumkin: ilova **oldingi planga qaytganda darhol** status so'rang va polling'ni davom ettiring.
- `poll_secret`ni log qilmang, diskka yozmang; so'rov tugagach xotiradan o'chiring.
- `device_id` — qurilmada bir marta yaratilgan UUID (+`-android`/`-ios`); Keychain/SharedPreferences'da saqlang.
- Tokenlarni odatdagi xavfsiz joyda saqlang (Keychain/EncryptedSharedPreferences) — email bilan kirishdagi kabi.
- Kirishdan keyin **ban**: bloklangan foydalanuvchi uchun API'lar `401 "Login kerak"` qaytaradi (mavjud xatti-harakat).
- Telegram orqali kirgan foydalanuvchida **email ko'rsatmang** — `email == null`; o'rniga "Telegram orqali kirgan". Parolni tiklash/email almashtirish bu akkauntlar uchun ma'nosiz (keyingi bosqichda "email ulash" ko'riladi).
- Telefon raqami (ixtiyoriy) faqat botda ulashiladi va serverda saqlanadi; hozircha API javoblarida chiqmaydi.

---
## 5. Xavfsizlik modeli
| Xavf | Himoya |
|---|---|
| Havolani bilgan boshqa odam sessiyani olishi | `poll_secret` havolada yo'q, faqat `start` javobida; bazada SHA-256 hash; noto'g'ri sir ham, yo'q `login_id` ham bir xil `404` |
| Birov boshqa odamga havola yuborib uning nomidan kirishi | `/start` sessiya bermaydi; **tasdiq tugmasi** shart, matnda platforma ko'rsatiladi: "Agar bu siz bo'lmasangiz, bosmang." (*to'liq yopilmaydi — pastga qarang*) |
| Sessiyani ikki marta olish / poyga | `tg_login_consume` `FOR UPDATE` bilan atomik: 8 parallel so'rovdan aynan bittasi oladi (real Postgres'da sinalgan) |
| Tokenlar bazadan sizib chiqishi | tokenlar bazaga yozilmaydi (faqat "kim" saqlanadi) |
| Soxta webhook | har so'rovda `X-Telegram-Bot-Api-Secret-Token` doimiy-vaqtli taqqoslanadi; noto'g'ri bo'lsa `401` va hech narsa bajarilmaydi |
| Boshqaning telefon raqami | `contact.user_id == from.id` tekshiriladi; boshqaning/uzatilgan kontakt rad etiladi |
| `start` ga hujum | IP (10/10 daq) va `device_id` (5/10 daq) limiti; xom IP/qurilma id saqlanmaydi (kalitli hash); eskirgan so'rovlar tozalanadi |
| Bloklangan foydalanuvchi | tasdiqlashda ham, sessiya berishda ham `user_bans` tekshiriladi (akkauntni o'chirish ham shu mexanizm) |
| Jadvallarga to'g'ridan-to'g'ri kirish | RLS yoqilgan, `anon/authenticated` huquqi yo'q, funksiyalar faqat `service_role` |

### Ma'lum cheklovlar
- **Ijtimoiy muhandislik:** hujumchi o'z `start` havolasini jabrlanuvchiga yuborib, "tasdiqla" desa va u tasdiqlasa, hujumchining qurilmasi **jabrlanuvchining** akkauntiga kiradi. Tasdiq matni shuni kamaytiradi, lekin yo'q qilmaydi. Yaxshilash (hozir QILINMAGAN): botdagi tasdiq xabariga so'rov qayerdan (mamlakat/shahar) kelganini qo'shish.
- **Supabase tezlik limiti:** sessiya server tomonda `verifyOtp` bilan yaratiladi — Vercel IP'laridan, hamma foydalanuvchilar uchun umumiy. Supabase Auth'da token tekshiruvi uchun IP bo'yicha limit bor (Auth → Rate Limits); foydalanuvchi ko'payganda uni oshirish kerak bo'lishi mumkin. Aniq qiymat tekshirilmagan.
- **Admin panel** (foydalanuvchilar ro'yxati) Telegram foydalanuvchisining sintetik emailini (`tg<ID>@users.trainertop.uz`) ko'rsatadi — bu Telegram ID'sini ochib turadi (faqat adminga). Keyin Telegram `@username` ustuni qo'shilishi mumkin.
- Telegram orqali ochilgan akkaunt doim `user` roli bilan; trener bo'lish — odatdagi "Trener bo'lish" oqimi.

---
## 6. Ma'lumotlar va maxfiylik
Saqlanadi (`telegram_accounts`): Telegram ID, username, ism, familiya, (ixtiyoriy) telefon, bog'langan sana. Yangi foydalanuvchida profil: `full_name` = Telegram ism-familiya; `username` — Telegram username bo'yicha taklif (band/yaroqsiz bo'lsa raqam qo'shib; bo'lmasa bo'sh); avatar — Telegram profil rasmi (bo'lsa, ≤2 MB, R2'ga yuklanadi, faqat avatar bo'sh bo'lsa).
Supabase Auth uchun sintetik email: `tg<ID>@users.trainertop.uz` (foydalanuvchiga ko'rsatilmaydi, unga xat yuborilmaydi).
`/privacy` (uz va en) yangilangan.
**Akkaunt o'chirilganda** (`DELETE /api/account`): Telegram bog'lanishi o'chadi va sintetik email `deleted-<id>@…` ga almashtiriladi (Telegram ID saqlanib qolmasin va o'sha Telegram keyin yangi akkaunt ocha olsin). Hisobning o'zi odatdagidek anonimlashtiriladi va doimiy bloklanadi.

---
## 7. Kod xaritasi
| Qism | Fayl |
|---|---|
| Baza | `supabase/migration-v33-telegram-login.sql` |
| Start / status / webhook | `src/app/api/auth/telegram/{start,status,webhook}/route.ts` |
| Bot mantig'i | `src/lib/telegram-webhook.ts` (matnlar — `TEXT`) |
| Foydalanuvchi, sessiya, username, avatar | `src/lib/telegram-auth.ts` |
| Bot API o'rami | `src/lib/telegram-bot.ts` |
| Toza yordamchilar | `src/lib/telegram-login.ts`, `src/lib/synthetic-email.ts` |
| Sayt tugmasi | `src/components/auth/TelegramLoginButton.tsx` (login va ro'yxat sahifalarida) |

---
## 8. Keyingi bosqich (HOZIR EMAS — faqat reja)
**Email bilan kirgan foydalanuvchi profilda "Telegram'ni ulash":** shu oqim, lekin mavjud akkauntga bog'lash.
- `telegram_login_requests` ga `mode` (`login` | `link`) va `link_user_id` qo'shiladi. `POST /api/auth/telegram/link/start` (**loginli**) shu foydalanuvchi uchun `link` so'rovi yaratadi.
- Botda tasdiqlangach: o'sha Telegram boshqa akkauntga bog'lanmagan bo'lsa — `telegram_accounts` ga `link_user_id` bilan yoziladi, **sessiya berilmaydi**; status `{status:"linked"}`.
- Telegram allaqachon boshqa akkauntga bog'langan bo'lsa — rad etiladi (yoki "o'sha akkaunt bilan kiring"); akkauntlarni birlashtirish alohida, ehtiyotkor qaror.
- Ulangan Telegram'ni uzish faqat boshqa kirish usuli (email/parol) bo'lsa mumkin — foydalanuvchi akkauntdan chiqib ketmasligi uchun.
- Email bilan kirgan akkaunt sintetik emailga ega emas — `displayEmail` o'zgarishsiz ishlaydi.

---
## 9. Sinov natijalari
- **SQL (real Postgres 16):** funksiyalar va jadvallar; bir martalik olish (8 parallel oqim poygasi), noto'g'ri sir/yo'q id (bir xil javob), muddat (kutilayotgan va tasdiqlangan), bekor, release, tezlik limiti (IP/qurilma/oyna), tozalash, ruxsatlar (anon/authenticated), cascade, qayta ishga tushirish. 35 mutantdan 34 tasi tutildi; 1 tasi ekvivalent (`release` dagi ortiqcha holat sharti).
- **JS:** yordamchilar, `start`/`status` (tasdiqsiz/noto'g'ri sir/muddati o'tgan/ikkinchi marta/ban), webhook (**tasdiqsiz `/start` sessiya ham akkaunt ham bermasligi**, noto'g'ri secret, boshqaning kontakti, ban), foydalanuvchi/sessiya/username/avatar, bot o'rami, akkaunt o'chirish, profil, tugma UI, sahifalar.
- **TekshirilMAGAN:** haqiqiy Supabase Auth va Telegram (yuqorida); brauzer/ilovada vizual ko'rinish; yuklama ostida; `verifyOtp` ning `magiclink`/`email` turlaridan qaysi biri sizning Supabase versiyangizda ishlashi (kod ikkalasini ham sinaydi).
