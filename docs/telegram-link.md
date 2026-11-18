# Telegram'ni mavjud akkauntga ulash + email qo'shish (v47) — sayt, Android, iOS uchun umumiy

**Nima uchun:** Telegram orqali kirgan foydalanuvchi (yangi akkaunt ochiladi) avval email/Google/Apple bilan ro'yxatdan o'tgan bo'lsa — **dublikat akkaunt** paydo bo'ladi. Bu hujjat dublikatni oldini oladi va yo'q qiladi:
1. **Telegram'ni ulash** — email/Google/Apple bilan kirgan foydalanuvchi Telegram'ni shu akkauntga bog'laydi.
2. **Email qo'shish** — Telegram orqali ochilgan akkauntga email + parol qo'shiladi (keyin email bilan ham kira oladi).
3. `GET /api/profile` → `login_methods` — "Kirish usullari" ekrani uchun.

Kirish oqimi (`docs/telegram-login.md`) **o'zgarmagan**. Bu hujjatdagi hamma endpoint **LOGIN talab qiladi** (`Authorization: Bearer <access_token>`; saytda cookie).

> **Holat:** kod va testlar tayyor. **Haqiqiy Supabase, Resend va Telegram bilan jonli sinalmagan** — deploy'dan keyin pastdagi "Jonli sinov" ro'yxatini bajaring.

> ### ⚠️ v48 yangilanishi: ulashda ham raqam olinadi (batafsil: `docs/phone-identity.md`)
> Akkauntda tasdiqlangan raqam bo'lmasa, bot «✅ Ulash» dan oldin **raqam so'raydi**; raqam akkauntga **faqat u yerda raqam bo'lmasa** yoziladi. Yangi `conflict` kodi: **`PHONE_TAKEN`** — «Bu telefon raqam boshqa akkauntga tegishli. Yordam xizmatiga yozing.» (hech narsa o'zgarmaydi; bo'sh dublikat o'chirilgan bo'lsa uning raqami ham bo'shab, shu akkauntga o'tadi). `GET /api/profile` → `login_methods.phone = { verified, masked }`.

---
## 1. Deploy tartibi (MUHIM: avval SQL)
1. **SQL:** `supabase/migration-v34-telegram-link.sql` (`v33` dan keyin; hozirgi bazada `v31–v33` bo'lishi kerak). Oxirida `natija = OK`.
2. **Keyin kod.** ⚠️ Kodni SQL'dan OLDIN chiqarmang: webhook endi `telegram_login_requests.mode` va `link_user_id` ustunlarini o'qiydi — ustunlar yo'q bo'lsa **Telegram orqali KIRISH ham buziladi**.
3. **Yangi env yo'q.** Email qo'shish uchun mavjud o'zgaruvchilar kerak: `RESEND_API_KEY` (support xatlari uchun allaqachon bor; **bo'lmasa email qo'shish 503 `EMAIL_NOT_CONFIGURED` beradi**), `PAYOUT_CARD_KEY` (karta shifrlash kaliti; parolni vaqtincha shifrlash uchun undan alohida *subkalit* olinadi) va ixtiyoriy `SUPPORT_FROM_EMAIL` (jo'natuvchi). Telegram o'zgaruvchilari (`TELEGRAM_LOGIN_*`) o'zgarmagan.
4. Webhook qayta ulanmaydi (yo'l va secret o'sha).

### Jonli sinov (10 daqiqa)
1. **Oddiy ulash:** email bilan kiring → Profil → Sozlamalar → Kirish usullari → Telegram: **Ulash** → botda Start → matnda akkaunt ismingiz ko'rinsin → **✅ Ulash** → "Telegram ulandi". Chiqib, "Telegram orqali kirish" bilan kiring → o'sha akkauntga tushishi kerak (yangi akkaunt OCHILMASIN).
2. **Dublikatni yo'q qilish:** yangi Telegram bilan "Telegram orqali kirish" (bo'sh akkaunt ochiladi) → chiqing → email bilan kiring → shu Telegram'ni ulang → "bo'sh akkaunt o'chirildi" deyilsin. Supabase → Authentication → Users da dublikat yo'qolgan bo'lishi kerak.
3. **Conflict:** Telegram akkauntida post/darslik/xarid/xabar bor bo'lsin → boshqa (email) akkauntdan shu Telegram'ni ulashga urining → "Bu Telegram boshqa akkauntga ulangan. Yordam xizmatiga yozing." Ikkala akkaunt ham joyida qolsin.
4. **Uzish:** email+Telegram akkauntida "Uzish" ishlasin; faqat-Telegram akkauntda "Uzish" o'chiq bo'lsin.
5. **Email qo'shish:** faqat-Telegram akkauntda "Email qo'shish" → kod emailga kelsin (**Resend yetkazishini tekshiring, spam ham**) → tasdiqlang → chiqib, email+parol bilan kiring → shu akkauntga tushsin.
6. **Eslatma:** butunlay yangi Telegram bilan kiring → pastda bir martalik "Yangi akkaunt ochildi" kartasi chiqsin; "Tushunarli" dan keyin qayta chiqmasin.

---
## 2. API

Barcha javoblar `Cache-Control: no-store`. Xato tanasi: `{ "code": "...", "message": "..." }`. Login yo'q/yaroqsiz bo'lsa hamma yerda `401 { code: "UNAUTHORIZED" }`.

### 2.1 `POST /api/auth/telegram/link/start`
So'rov: `{ "platform": "android" | "ios" | "web", "device_id"?: "..." }` — **kirish `/start` bilan bir xil**.
Javob 200 — kirishdagi `start` bilan bir xil maydonlar + `mode: "link"`:
```json
{ "mode": "link", "login_id": "<uuid>", "poll_secret": "<43 belgi>", "expires_at": "<ISO>", "expires_in": 300, "poll_interval_ms": 2000,
  "bot_url": "https://t.me/<bot>?start=login_<uuid>", "tg_url": "tg://resolve?domain=<bot>&start=login_<uuid>" }
```
`poll_secret` faqat shu javobda; havolada yo'q; xotirada saqlang, logga yozmang.

| HTTP | `code` | Ma'nosi |
|---|---|---|
| 400 | `BAD_PLATFORM` | platform noto'g'ri |
| 409 | `ALREADY_LINKED` | akkauntga Telegram allaqachon ulangan (`telegram.username` bilan) — yangi so'rov YARATILMAYDI; ekranni yangilang |
| 429 | `RATE_LIMITED` | juda ko'p urinish (+`Retry-After: 60`). Limit: IP 10, qurilma 5, foydalanuvchi 5 ta / 10 daqiqa |
| 503 | `TELEGRAM_NOT_CONFIGURED` | server sozlanmagan |

### 2.2 `GET /api/auth/telegram/link/status?login_id=<uuid>&poll_secret=<43 belgi>`
**Sessiya BERMAYDI** (foydalanuvchi allaqachon kirgan). Holatlarni takror so'rash xavfsiz.
| HTTP | Tana | Nima qilish |
|---|---|---|
| 200 | `{ "status": "pending" }` | `poll_interval_ms` dan keyin yana so'rang |
| 200 | `{ "status": "linked", "telegram": { "username": "ali_v" \| null }, "merged_empty_account": false }` | muvaffaqiyat; pollingni to'xtating; profilni (`login_methods`) yangilang. `merged_empty_account: true` — Telegram bo'sh dublikatga ulangan edi va u **o'chirildi** (foydalanuvchiga ayting) |
| 200 | `{ "status": "conflict", "code": "TELEGRAM_TAKEN" \| "USER_HAS_TELEGRAM", "message": "..." }` | **hech narsa o'zgarmagan**; `message` ni ko'rsating, pollingni to'xtating |
| 200 | `{ "status": "expired" }` / `{ "status": "cancelled" }` | to'xtating; "Qayta urinish" = yangi `link/start` |
| 400 | `BAD_REQUEST` | parametr shakli |
| 404 | `NOT_FOUND` | so'rov yo'q / sir noto'g'ri / **boshqa foydalanuvchining so'rovi** / bu ulash so'rovi emas (farqlanmaydi) |

`conflict` kodlari:
- `TELEGRAM_TAKEN` — "Bu Telegram boshqa akkauntga ulangan. Yordam xizmatiga yozing." (o'sha akkaunt bo'sh emas)
- `USER_HAS_TELEGRAM` — "Akkauntingizga boshqa Telegram allaqachon ulangan. Avval uni uzing." (bitta akkauntga bitta Telegram)

Polling qoidalari kirishdagi bilan bir xil (`docs/telegram-login.md` §3.3): ketma-ket so'rovlar, `expires_at` dan 5 s keyin "Vaqt tugadi", ketma-ket 5 ta tarmoq xatosidan keyin to'xtash.

### 2.3 `DELETE /api/auth/telegram/link` — Telegram'ni uzish
| HTTP | Tana |
|---|---|
| 200 | `{ "success": true }` |
| 404 | `NOT_LINKED` — ulanmagan |
| 409 | `LAST_LOGIN_METHOD` — "Telegram — akkauntingizdagi yagona kirish usuli. Avval email qo'shing." |

Faqat akkauntda **haqiqiy email** (email/Google/Apple) bo'lsa mumkin. UI da: `login_methods.telegram.can_unlink == false` bo'lsa tugmani o'chiring va sababini ko'rsating.

### 2.4 `POST /api/account/email/start` — emailga kod yuborish
FAQAT Telegram orqali ochilgan akkaunt (`login_methods.email.set == false`) uchun.
So'rov: `{ "email": "ali@gmail.com", "password": "kamida6belgi" }` (parol 6–72 belgi; email kichik harfga o'tkaziladi).
Javob 200: `{ "success": true, "email": "ali@gmail.com", "expires_in": 600 }` — 6 xonali kod 10 daqiqa amal qiladi. **Kod va parol javobda yo'q.**
| HTTP | `code` | Ma'nosi |
|---|---|---|
| 400 | `BAD_EMAIL` / `BAD_PASSWORD` | shakl noto'g'ri |
| 409 | `EMAIL_ALREADY_SET` | akkauntda email allaqachon bor |
| 409 | `EMAIL_TAKEN` | email boshqa akkauntda band. **Tavsiya matni:** "Agar bu sizning akkauntingiz bo'lsa — shu email bilan kiring va u yerda Kirish usullari → Telegram'ni ulash ni bosing." |
| 429 | `RATE_LIMITED` | bir foydalanuvchi 3 ta / soat, bir IP 10 ta / soat (+`Retry-After: 3600`) |
| 502 | `EMAIL_SEND_FAILED` | kod yuborilmadi |
| 503 | `EMAIL_NOT_CONFIGURED` | `RESEND_API_KEY` yoki `PAYOUT_CARD_KEY` yo'q |

Yangi `start` oldingi kodni bekor qiladi ("Kodni qayta yuborish" = yana `start`).

### 2.5 `POST /api/account/email/verify`
So'rov: `{ "email": "ali@gmail.com", "code": "123456" }` (kod — aynan 6 raqam).
Javob 200: `{ "success": true, "email": "ali@gmail.com" }` — sintetik email haqiqiysi bilan almashtirildi va `start`dagi **parol o'rnatildi**; shundan keyin email + parol bilan ham **o'sha akkauntga** kiriladi. Ilova profilni qayta yuklasin (`email` endi to'lgan, `login_provider: "email"`).
| HTTP | `code` | Ma'nosi |
|---|---|---|
| 400 | `BAD_REQUEST` | email/kod shakli |
| 400 | `NO_PENDING_REQUEST` | avval kod so'rang (yoki boshqa email) |
| 400 | `CODE_EXPIRED` | eskirgan — yangi kod so'rang |
| 400 | `BAD_CODE` + `attempts_left` | noto'g'ri kod (jami 5 ta urinish) |
| 429 | `TOO_MANY_ATTEMPTS` | 5 urinish tugadi — yangi kod so'rang |
| 409 | `EMAIL_ALREADY_SET` / `EMAIL_TAKEN` | yuqoridagidek (kod to'g'ri bo'lsa ham email shu orada band bo'lib qolgan bo'lishi mumkin) |
| 500 | `SERVER_ERROR` | vaqtincha xato: kod **qayta ishlatiladi**, shu kod bilan yana urining |

### 2.6 `GET /api/profile` → `login_methods`
```json
"login_methods": {
  "telegram": { "linked": true, "username": "ali_v", "can_unlink": false },
  "email":    { "set": false, "address": null }
}
```
- `can_unlink = linked && email.set`. `email.address` — faqat haqiqiy email; **sintetik manzil hech qachon ko'rinmaydi**.
- Qolgan maydonlar o'zgarmagan (`email: null` va `login_provider: "telegram"` — faqat-Telegram akkauntda).

---
## 3. Qoidalar (aniq)

### 3.1 Ulash natijalari (hammasi bazada BITTA tranzaksiyada — `tg_link_apply`)
| Holat | Natija |
|---|---|
| Telegram hech kimga ulanmagan | ulanadi (`linked`) |
| Telegram allaqachon **shu** akkauntga ulangan | `linked` (hech narsa o'zgarmaydi) |
| Joriy akkauntga **boshqa** Telegram ulangan | `conflict` / `USER_HAS_TELEGRAM`, hech narsa o'zgarmaydi |
| Telegram **bo'sh** boshqa akkauntga ulangan | o'sha akkaunt **o'chiriladi**, Telegram joriy akkauntga ulanadi (`linked`, `merged_empty_account: true`) |
| Telegram **bo'sh emas** boshqa akkauntga ulangan | `conflict` / `TELEGRAM_TAKEN`, **hech narsa o'zgarmaydi** |

### 3.2 "Bo'sh akkaunt" — aniq qoida (`tg_account_blockers`)
Akkaunt FAQAT quyidagilarning HAMMASI bajarilsa bo'sh hisoblanadi va o'chirilishi mumkin:
1. **`role = 'user'`** (trener ham, admin ham emas).
2. **Sintetik email** (`tg<ID>@users.trainertop.uz`) — ya'ni akkauntning **o'zining email/Google/Apple kirishi YO'Q**. (Spetsifikatsiyadagi ro'yxatdan qat'iyroq: o'zining kirish usuli bor akkauntni, bo'sh bo'lsa ham, o'chirmaymiz — egasi u bilan kirishi mumkin.)
3. `profiles(id)` ga bog'langan **HECH BIR jadvalda qator yo'q** — baza katalogidan barcha tashqi kalitlar (FK) skanerlanadi (hozir 34 ta jadval, 50 ta FK ustuni: darsliklar, postlar, xaridlar, balans/ledger, pul yechish, izohlar, savollar, suhbatlar va xabarlar, guruhlar, kuzatuvlar, layklar, sharhlar, shikoyatlar, bloklar, banlar, fitnes profil, qo'llab-quvvatlash murojaatlari va h.k.). **Kelajakda qo'shiladigan jadvallar avtomatik "ma'lumot" hisoblanadi** (xavfsiz tomon).
4. Istisno — faqat tizim o'zi yozadigan jadvallar: `telegram_accounts`, `telegram_login_requests`, `device_tokens` (push tokenlar), `notifications`, `announcement_reads`, `announcement_views`.
5. Ko'p ustunli FK (skaner o'qiy olmaydi) bo'lsa — xavfsiz tomon: bo'sh emas.
6. O'chirish xatosi (masalan, kutilmagan FK) → `conflict`, akkaunt joyida qoladi.

O'chirilganda: `auth.users` qatori (profil va bog'liq qatorlar cascade bilan) o'chadi, dublikatning R2'dagi avatari fonda tozalanadi. **Qaytarib bo'lmaydi** — shuning uchun qoida shunchalik qat'iy.

### 3.3 Poyga va izolyatsiya
- Bir Telegram'ni ikki foydalanuvchi bir vaqtda ulasa — aynan bittasi ulanadi (`pg_advisory_xact_lock` + `FOR UPDATE`; real Postgres'da sinalgan).
- O'chiriladigan dublikat profili tekshiruvdan oldin `FOR UPDATE` bilan qulflanadi: unga o'sha paytda ma'lumot yozilayotgan bo'lsa, ulash uni **kutadi**, ma'lumotni ko'radi va `conflict` beradi (ma'lumot yo'qolmaydi).
- Kirish va ulash so'rovlari bir jadvalda, lekin **bir-biriga o'tmaydi**: ulash so'rovi orqali sessiya olib bo'lmaydi (`tg_login_consume` faqat `login` rejimini oladi), kirish so'rovi esa ulash sifatida qo'llanmaydi. `CHECK` cheklovlari ham shuni majburlaydi.

### 3.4 Botdagi matnlar
- Ulash: **"Telegram'ni TrainerTop akkauntingizga (<ism>) ulaysizmi?"** + ikkinchi qator "Agar bu akkaunt sizniki bo'lmasa, bosmang." (spetsifikatsiyaga qo'shimcha — pastdagi xavf bandiga qarang); tugmalar **«✅ Ulash»** / **«❌ Bekor qilish»**.
- Natijalar: ulandi / ulandi + bo'sh akkaunt o'chirildi / "boshqa akkauntga ulangan, Yordam xizmatiga yozing: @TrainerTop_Support_Bot" / "akkauntingizga boshqa Telegram ulangan" / "havola eskirgan".

### 3.5 Xavf: kimdir o'z akkauntiga BOSHQANING Telegram'ini ulatishi
Hujumchi o'z akkauntidan ulash havolasini qurbonga yuborsa va qurbon «✅ Ulash» ni bossa — qurbonning Telegram'i **hujumchining** akkauntiga ulanadi (keyin qurbon "Telegram orqali kirish" ni bossa, hujumchining akkauntiga tushadi). Himoya: botdagi xabarda **akkaunt ismi** ko'rinadi va "sizniki bo'lmasa, bosmang" deyiladi; qurbonning Telegram'i bo'sh bo'lmagan akkauntga ulangan bo'lsa — ulash umuman o'tmaydi (`conflict`). To'liq yopilmaydi (ijtimoiy muhandislik). Keyingi yaxshilash (hozir YO'Q): so'rov qaysi mamlakat/qurilmadan kelganini botda ko'rsatish.

---
## 4. Ilova (Android/iOS) uchun UX tavsiyasi
- **Profil → Kirish usullari** ekrani: `GET /api/profile` → `login_methods`. Qatorlar: Telegram (`@username · Ulangan` / `Ulanmagan`; **Uzish** yoki **Ulash**), Email (manzil / **Email qo'shish**).
- **Ulash:** `link/start` → `tg_url` ni oching (o'rnatilmagan bo'lsa `bot_url`) → kirishdagi kabi polling (`link/status`) → `linked` da profilni yangilang; `conflict` da `message` ni ko'rsating. Ilova fonga o'tib qaytganda **darhol** status so'rang.
- **Email qo'shish:** 2 qadam (email+parol → kod). "Kodni qayta yuborish" = `start`ni qayta chaqirish (soatiga 3 ta). `EMAIL_TAKEN` da yuqoridagi tavsiya matnini ko'rsating.
- **Yangi Telegram akkaunti** (`is_new_user: true`) — bir martalik eslatma: "Avval email bilan ro'yxatdan o'tganmisiz? Email bilan kiring va Kirish usullari → Telegram'ni ulash qiling." (Saytda: pastdagi karta; **"Email bilan kirish"** tugmasi chiqib, `/login` ga o'tkazadi — akkaunt o'chirilmaydi; u keyin ulash paytida avtomatik tozalanadi.)
- Parolni logga/analitikaga yozmang; `poll_secret` kabi.

## 5. Sayt
- `components/profile/LoginMethods.tsx` (Profil → Sozlamalar; `/profile#login-methods` shu yorliqni ochadi), `TelegramLinkPanel.tsx`, `EmailAddForm.tsx`, `components/auth/NewTelegramUserNotice.tsx` (asosiy layout'da).
- Email qo'shilgach sahifa qayta yuklanadi (Navbar va auth holati yangilansin).

## 6. Ma'lumot saqlash
- `telegram_login_requests`: ulash so'rovlari (sir **hash**i, `link_user_id`, natija kodi); eskirgach 1 soatdan keyin tozalanadi.
- `email_add_requests`: email, kod **HMAC**i (kodning o'zi yo'q), parol **AES-256-GCM bilan shifrlangan** (ochiq parol bazaga hech qachon yozilmaydi; kalit — `PAYOUT_CARD_KEY` dan HKDF subkalit), urinishlar soni, muddat. 10 daqiqada eskiradi; 1 kundan keyin o'chiriladi; foydalanuvchi o'chsa cascade.
- Hamma jadval/funksiya faqat `service_role` uchun; RLS yoqilgan.

## 7. Sinov natijalari
- **SQL (real Postgres 16):** bo'shlik qoidasi har bir ma'lumot turi uchun (post, izoh, layk, savol, kuzatuv ikki yo'nalishda, blok, fitnes profil, ban, trener profili, suhbat+xabar, xarid, sharh, platforma sharhi, shikoyat, qo'llab-quvvatlash, trener/admin roli, o'z email'i) + kelajakdagi jadval va ko'p ustunli FK; `tg_link_apply` barcha natijalari; kechikkan yozuv poygasi; kirish poygasi; bir Telegram ikki akkauntga; bir so'rov 6 oqimda; parallel kod urinishlari (chegara aynan 5); rejimlar izolyatsiyasi; CHECK'lar; ruxsatlar; cascade; qayta ishga tushirish. **71 ta mutantdan 67 tasi tutildi**, 4 tasi ekvivalent (boshqa tekshiruv bilan takrorlangan: foydalanuvchi advisory lock'i profil `FOR UPDATE` bilan; `tg_link_status` dagi rejim tekshiruvi foydalanuvchi tekshiruvi bilan; `CHECK(mode)` rejim/holat `CHECK`i bilan; `REVOKE` `v33` dan saqlangan huquqlar bilan).
- **JS:** 161 mutantdan 158 tasi tutildi, 3 tasi ekvivalent (brauzer `type=email` qiymatni o'zi kesadi — 2 ta; linked'dan keyingi ortiqcha `stop()`).
- **TekshirilMAGAN:** haqiqiy `auth.admin.updateUserById` (email+parol almashtirish) va undan keyin mavjud sessiyalarning holati; Resend yetkazishi; `DELETE FROM auth.users` ning Supabase'dagi `postgres` roli ostidagi huquqi (mavjud `v27` tozalash funksiyasi ham xuddi shuni qiladi, shuning uchun ishlashi kutiladi); haqiqiy Telegram bilan ulash oqimi; brauzer/ilovada vizual ko'rinish.

## 8. Ma'lum cheklovlar
- Conflict bo'lganda foydalanuvchi **qo'lda** yordam xizmatiga yozadi — akkauntlarni birlashtirish vositasi yo'q (ma'lumotli ikki akkauntni qo'shish alohida, ehtiyotkor qaror).
- Saytda ulashdan oldin qaysi Telegram akkaunti ulanayotgani ko'rinmaydi (botda ko'rinadi).
- Telegram ulangan email akkauntida kimdir "Telegram orqali kirish" qilsa, u shu akkauntga tushadi (maqsad shu). Uzish — faqat haqiqiy email bo'lganda.
