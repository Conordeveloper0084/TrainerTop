# Telefon raqam — asosiy identifikator (v48, 1-BOSQICH: Telegram orqali, SMS'siz)

**Qaror:** har bir foydalanuvchining **tasdiqlangan telefon raqami** bo'lishi kerak (sotuv, aloqa, ishonch uchun). Asosiy kirish — Telegram (`@TrainerTop_auth_bot`): raqam botda **«📱 Raqamni ulashish»** bilan olinadi — Telegram raqamni o'zi tasdiqlagan, bizga **0 so'm**. SMS bilan kirish — 2-BOSQICH (hozir QILINMAGAN; arxitektura tayyor, reja pastda, §9).

> **Holat:** kod va testlar tayyor. **Haqiqiy Supabase va haqiqiy Telegram bilan jonli sinalmagan** (sandbox'dan ulanib bo'lmaydi) — deploy'dan keyin §2 dagi jonli sinovni bajaring.
> **Real foydalanuvchilar yo'q** (faqat test akkauntlar) deb hisoblandi; shuning uchun eski ma'lumotlarni ko'chirish murakkabligi yo'q.

---
## 1. Nima o'zgardi (qisqa)
| Qism | Oldin | Endi |
|---|---|---|
| Telegram orqali kirish | `/start` → darhol tasdiq tugmasi; raqam ixtiyoriy, kirgandan KEYIN so'raladi | `/start` → akkauntda tasdiqlangan raqam bo'lmasa **avval raqam so'raladi**; **raqamsiz tasdiq tugmasi chiqmaydi** |
| Akkauntni aniqlash | faqat Telegram ID bo'yicha | Telegram ID **va tasdiqlangan raqam** bo'yicha (bitta tranzaksiyada, bazada) — **dublikat ochilmaydi** |
| `profiles.phone` | foydalanuvchi qo'lda yozadigan erkin matn | **faqat tasdiqlangan** E.164 raqam, `UNIQUE`, manbasi va tasdiq vaqti bilan |
| Ulash (link) oqimi | raqam yo'q | ulashda ham raqam olinadi va akkauntga yoziladi |
| Email bilan ro'yxatdan o'tish | bor | **olib tashlangan** (`/register` → Telegram). Email bilan **kirish** kichik «Boshqa usul bilan kirish» ostida qoladi |
| Profil → telefon maydoni | tahrirlanadi | tahrirlanmaydi; maskalangan raqam + «Tasdiqlangan» belgisi |
| Admin | — | foydalanuvchi/trener kartasida to'liq raqam, manba, eski raqamlar, to'qnashuv belgisi; raqam bo'yicha qidiruv |

Kirish/ulash **endpointlari va polling qoidalari O'ZGARMAGAN** (ilovalar allaqachon ishlatadi) — faqat bot ichidagi qadamlar qo'shildi.

---
## 2. Deploy tartibi (MUHIM: avval SQL)
1. **SQL** (Supabase → SQL Editor), shu tartibda, hali ishga tushirilmaganlarini: `migration-v33` → `v34` → **`migration-v35-phone-identity.sql`**. Oxirida `natija = OK`.
   - v35 eski erkin matnli telefonlarni **tozalaydi** (tasdiqlanmagan), lekin nusxasini `_phone_backup_v35` jadvaliga saqlaydi. Tasdiqlanganlarga tegmaydi; qayta ishga tushirish xavfsiz.
2. **Keyin kod.** ⚠️ Kodni SQL'dan OLDIN chiqarmang: webhook yangi funksiyalarni (`tg_identify`, `tg_login_start_seen`, …), hisobni o'chirish `clear_user_phone` ni, profil esa yangi ustunlarni ishlatadi — yo'q bo'lsa Telegram orqali kirish va hisobni o'chirish xato beradi.
3. **Yangi env yo'q.** Webhook, bot, secret o'zgarmaydi (qayta ulash shart emas).
4. **BotFather'da hech narsa o'zgarmaydi.** («Allow Groups» o'chirilgani tavsiya.)

### Jonli sinov (10 daqiqa)
1. **Yangi foydalanuvchi:** yangi Telegram bilan «Telegram orqali kirish» → botda Start → **avval «📱 Raqamni ulashish»** so'ralsin, tasdiq tugmasi chiqmasin → raqamni ulashing → «✅ Raqam qabul qilindi» (klaviatura yo'qolsin) → «Siz <ism> sifatida (+998 •• ••• •• 67) …» + ✅/❌ → ✅ → sayt kirsin. Profil → Kirish usullari → Telefon «Tasdiqlangan».
2. **Qayta kirish:** o'sha Telegram bilan qayta kiring → raqam QAYTA so'ralmasin, to'g'ridan-to'g'ri tasdiq xabari.
3. **Boshqaning kontakti:** botga boshqa odamning kontaktini yuboring (yoki forward qiling) → «Faqat o'z raqamingizni ulashing» deyilsin, hech narsa saqlanmasin.
4. **Raqamsiz tasdiq:** `/start` dan keyin raqam ulashmasdan eski xabardagi tugmani bosishga urining (agar bor bo'lsa) → «Avval raqamingizni ulashing».
5. **Raqam bo'yicha mavjud akkaunt:** Supabase'da test akkauntga qo'lda tasdiqlangan raqam yozing (SQL pastda), Telegram'siz yangi Telegram bilan shu raqamni ulashing → **yangi akkaunt ochilmasin**, o'sha akkauntga kirilsin.
6. **Hisobni o'chirish:** akkauntni o'chiring → `profiles.phone` bo'sh, `phone_history`/`phone_conflicts` da qator qolmagan; o'sha Telegram+raqam bilan qayta ro'yxatdan o'tish mumkin.
7. **Admin:** Foydalanuvchilar/Trenerlarda to'liq raqam va manba ko'rinsin; qidiruvga raqam yozing.

Test raqam yozish (faqat sinov uchun): `update profiles set phone='+998901112233', phone_verified_at=now(), phone_source='telegram' where id='<uuid>';`

---
## 3. Bot oqimi

**Kirish (`mode=login`):**
1. `/start login_<id>` → bot kim bosganini yozadi (`tg_login_start_seen`). Telegram bog'langan akkauntda tasdiqlangan raqam **bor** bo'lsa — 3-qadamga; **yo'q** bo'lsa (yoki Telegram bog'lanmagan) — 2-qadam.
2. Bot: «TrainerTop'ga kirish uchun telefon raqamingizni ulashing…» + reply klaviatura **«📱 Raqamni ulashish»** (`request_contact`). Tasdiq tugmasi chiqmaydi.
3. Kontakt kelganda: **`contact.user_id == from.id` SHART** (boshqaning/forward qilingan kontakt rad etiladi: «Faqat o'z raqamingizni ulashing»). Raqam **E.164** ga keltiriladi (`+998XXXXXXXXX`; +998 uchun aniq 9 raqam; yaroqsiz bo'lsa «o'qib bo'lmadi»). Raqam shu odam so'nggi `/start` bosgan ochiq so'rovga yoziladi.
4. Bot: «✅ Raqam qabul qilindi: +998 •• ••• •• 67» (**reply klaviatura olib tashlanadi**), so'ng tasdiq xabari:
   `Siz <ism> sifatida (+998 •• ••• •• 67) TrainerTop'ga kiryapsiz. Agar bu siz bo'lmasangiz, bosmang.` + ikkinchi qator `Qayerdan: Android | iOS | veb-sayt` (spetsifikatsiyaga qo'shimcha: qaysi qurilmadan so'ralgani ko'rinsin) + **«✅ Kirishni tasdiqlash» / «❌ Bekor qilish»**. `<ism>` — kirilayotgan akkaunt nomi (raqam bo'yicha mavjud akkaunt bo'lsa — o'sha akkaunt nomi).
5. ✅ → bazada akkaunt aniqlanadi (§4) → so'rov tasdiqlanadi → ilova/sayt `status` polling'da `confirmed` oladi (avvalgidek).

**Ulash (`mode=link`):** xuddi shunday, lekin akkauntda tasdiqlangan raqam bo'lmasagina so'raladi; tasdiq xabari: `Telegram'ni TrainerTop akkauntingizga (<ism>) ulaysizmi?` (+ `Raqam: <maska>`) + «Agar bu akkaunt sizniki bo'lmasa, bosmang.» + «✅ Ulash» / «❌ Bekor qilish». Raqam akkauntga **faqat u yerda tasdiqlangan raqam bo'lmasa** yoziladi; bor bo'lsa (boshqacha bo'lsa ham) tegilmaydi.

**Muhim:** `/start` HECH QACHON sessiya ham, akkaunt ham bermaydi — faqat tasdiq tugmasi. Raqamni **tugmani bosgan odamning o'zi** ulashgan bo'lishi shart (`phone_tg_user_id`); boshqa odam `/start` bossa, oldingi odamning ulashgan raqami bekor bo'ladi.

> **Savol/qaror:** bot raqamni har kirishda emas, faqat akkauntda tasdiqlangan raqam **bo'lmaganda** so'raydi (sizning "mavjud akkauntlarda raqam yo'q bo'lsa keyingi kirishda so'raladi" bandingiz). Shuning uchun "raqam boshqacha bo'lsa yangilanadi" qoidasi bazada to'liq bor va testlangan (§4), lekin botda amalda faqat raqami yo'q akkauntlar uchun ishga tushadi.

---
## 4. Akkauntni aniqlash (`tg_identify` — bitta tranzaksiya, parallel chaqiruvlarga chidamli)
`A` — Telegram bog'langan akkaunt; `P` — shu **tasdiqlangan** raqamli akkaunt.

| Holat | Natija |
|---|---|
| `A` bor, raqam yuborilmagan, `A` da raqam bor | `existing` — o'sha akkaunt |
| `A` bor, raqam yo'q (ikkalasida ham) | `phone_required` — bot raqam so'raydi |
| `A` bor, `A` da raqam yo'q, raqam hech kimniki emas | `existing`, raqam `A` ga yoziladi (`phone_event: set`) |
| `A` bor, `A` da **boshqa** raqam, yangi raqam hech kimniki emas | `existing`, raqam **yangisi bilan yangilanadi**, eskisi `phone_history` ga (`updated`) |
| `A` bor, raqam `A` niki | `existing` (`unchanged`) |
| **To'qnashuv:** `A` bor, raqam **boshqa** `P` akkauntniki | `existing` — **`A` ga kiriladi, raqam O'ZGARTIRILMAYDI**; hodisa `phone_conflicts` ga yoziladi (admin ko'radi), takrorlansa `seen_count` oshadi |
| `A` yo'q, `P` bor, `P` ga Telegram ulanmagan | `phone_account` — Telegram `P` ga ulanadi, **`P` ga kiriladi (dublikat ochilmaydi)** |
| `A` yo'q, `P` bor, lekin `P` ga **boshqa** Telegram ulangan | `phone_taken_other_telegram` — kirish **rad etiladi** (so'rov `cancelled`, bot sababini aytadi: «Bu raqam boshqa Telegram akkauntga ulangan. Yordam xizmatiga yozing»), hodisa yoziladi |
| `A` yo'q, `P` yo'q, raqam yo'q | `phone_required` |
| `A` yo'q, `P` yo'q, raqam bor | yangi akkaunt (raqam bilan; sintetik email avvalgidek); `is_new_user: true` |

Auth foydalanuvchisini yaratish bazada mumkin emas, shuning uchun 2 bosqich: baza `needs_new` desa server `auth.admin.createUser` qiladi va `tg_identify` ni `p_new_user_id` bilan qayta chaqiradi; baza qayta tekshiradi, poyga bo'lsa ortiqcha yaratilgan foydalanuvchi o'chiriladi.

**Ulash (`tg_link_apply`) qo'shimcha natijalari:** `phone_required` (akkauntda ham, so'rovda ham raqam yo'q — hech narsa o'zgarmadi), `conflict_phone_taken` (raqam boshqa akkauntniki — hech narsa o'zgarmadi; status endpointida `conflict` + `code: "PHONE_TAKEN"`, matn: «Bu telefon raqam boshqa akkauntga tegishli. Yordam xizmatiga yozing.»). Bo'sh dublikat o'chirilganda uning raqami ham bo'shaydi va joriy akkauntga o'tadi.

---
## 5. Ma'lumot modeli
`profiles`: `phone` (E.164, **UNIQUE**, faqat tasdiqlanganlar), `phone_verified_at`, `phone_source` (`telegram` | keyinchalik `sms`). DB darajasida:
- `CHECK`: raqam bo'lsa — format `^\+[1-9][0-9]{6,14}$`, tasdiq vaqti va manba **majburiy**; raqam yo'q bo'lsa — ikkalasi ham `NULL`.
- Trigger: **brauzer** (anon/authenticated) bu ustunlarni o'zgartira olmaydi (`protect_profiles` namunasida); raqam `NULL` bo'lsa tasdiq belgilari tozalanadi.
- Trigger: o'zgargan/olib tashlangan raqam **`phone_history`** ga yoziladi.
- `phone_conflicts` — to'qnashuv hodisalari (ochiq/hal qilingan, `seen_count`). Hammasi faqat server (`service_role`), RLS yoqilgan.
- «Bo'sh akkaunt» qoidasi (v47 dublikat o'chirish) `phone_history`/`phone_conflicts` ni ma'lumot hisoblamaydi — shuning uchun raqamli Telegram-dublikat hamon «bo'sh».
- Hisobni o'chirish: `clear_user_phone` — raqam, tarix va to'qnashuvlar **butunlay** o'chadi (raqam bo'shaydi).

---
## 6. API (ilovalar uchun — o'zgarishlar minimal)
**`GET /api/profile`** (faqat egasi) — mavjud maydonlarga qo'shimcha:
```json
{ "phone": "+998901234567", "phone_verified": true, "phone_verified_at": "2026-11-10T10:00:00Z", "phone_source": "telegram",
  "login_methods": { "telegram": { "linked": true, "username": "ali_v", "can_unlink": false },
                     "email":    { "set": false, "address": null },
                     "phone":    { "verified": true, "masked": "+998 •• ••• •• 67" } } }
```
- `phone` — **faqat egasiga** (boshqa hech bir javobda yo'q). UI'da **maska** (`login_methods.phone.masked`) ko'rsating; xom raqamni ekranga chiqarmang.
- Raqam yo'q (eski akkaunt): `phone: null`, `phone_verified: false`, `login_methods.phone = { verified: false, masked: null }`.

**Telegram `status` → `confirmed`**: o'zgarmagan, faqat `user` ga ixtiyoriy `phone_masked` qo'shildi (maska yoki `null`).

**`PUT /api/profile`**: `phone` maydoni **e'tiborsiz qoldiriladi** (xato bermaydi). Raqam endi faqat tasdiqlash orqali o'rnatiladi — ilovada telefon **kiritish maydonini olib tashlang**.

**Ulash status'i**: `conflict` kodlari: `TELEGRAM_TAKEN`, `USER_HAS_TELEGRAM`, **`PHONE_TAKEN`** (yangi; `message` ni ko'rsating).

---
## 7. Ilovalar (Android/iOS) uchun UI tavsiyasi
1. **Kirish ekrani:** «Telegram orqali kirish» — birinchi katta tugma. Email bilan kirishni **kichik «Boshqa usul bilan kirish»** havolasiga olib o'ting (bosilganda email+parol shakli ochiladi; xato/tasdiqlanmagan email bilan qaytganda o'zi ochilsin). Google/Apple tekshiruvchilari **demo akkauntga email orqali** kiradi — shu havola ostida qoladi (2-bosqichda test telefon raqamiga almashtiriladi).
2. **Ro'yxatdan o'tish:** email bilan ro'yxatdan o'tishni **olib tashlang** — «Telegram orqali ro'yxatdan o'tish» ga yo'naltiring. Matn: «Telefon raqamingiz kerak bo'ladi — Telegram botida «📱 Raqamni ulashish» bilan bir bosishda tasdiqlanadi. Raqam boshqalarga ko'rinmaydi.»
3. **Profil → Kirish usullari:** «Telefon» qatori: maska + «Tasdiqlangan» belgisi; yo'q bo'lsa «Raqam ulanmagan» + «Telegram orqali kiring yoki Telegram'ni ulang».
4. **Raqamni hech qayerda tahrirlanadigan qilmang**; boshqa foydalanuvchilarning raqamini hech qayerda ko'rsatmang (API ham bermaydi).
5. Telegram oqimi, polling, sessiyani import qilish — **o'zgarmagan** (`docs/telegram-login.md`). Faqat foydalanuvchi botda yana bitta qadam (raqam) ko'radi; ilova hech narsa qilmasligi kerak, status polling shuni kutadi (muddat 5 daqiqa).
6. Telegram'siz eski akkaunt (email/Google) raqamsiz qoladi: ularga «Telegram'ni ulash» (v47) orqali raqam yoziladi.

---
## 8. Maxfiylik: raqam kimga ko'rinadi
- **Egasi:** `GET /api/profile` (to'liq) va UI (maska). **Admin:** to'liq (admin API/panel). **Hech kim boshqa:** ommaviy route'lar `profiles` dan faqat aniq ustunlar (`id, full_name, avatar_url, …`) oladi.
- Brauzer/anon kaliti bilan o'qib bo'lmaydi: `v14b` (yangi ustunlar avtomatik yopiq) + yozish triggeri.
- **Statik audit testi** (`phone-identity-privacy.test.ts`): ommaviy route'larda `phone` so'zi yo'q, `profiles` dan `select("*")` va `*`/`phone`/`email` li embed yo'q; klientda raqam ma'lumotiga faqat admin paneli va egasining «Kirish usullari» bloki tegadi. Yangi kod raqamni ochsa — test to'xtatadi.
- `/privacy` (uz+en): raqam majburiy, maqsadi, kimga ko'rinishi, tarix, o'chirishda tozalanishi yozilgan.
- Bot xabarlarida raqam faqat maskalangan.

---
## 9. 2-BOSQICH REJASI (kod EMAS): telefon + SMS kod (Telegram'siz foydalanuvchilar uchun)
Hozir QILINMAGAN. Arxitektura shunga tayyor: `phone_source` da `'sms'` allaqachon ruxsat etilgan; akkaunt aniqlash qoidalari raqamga asoslangan; sessiya berish (`issueSession`) foydalanuvchi ID bo'yicha ishlaydi.

**Endpointlar (kirishdagi shaklga o'xshash, ilovalar uchun qulay):**
- `POST /api/auth/phone/start` `{ phone, platform, device_id?, captcha_token? }` → `200 { request_id, expires_in: 300, resend_after: 60 }`. Xatolar: `BAD_PHONE`, `PHONE_NOT_ALLOWED` (faqat +998), `RATE_LIMITED`, `CAPTCHA_FAILED`, `SMS_DISABLED` (kill-switch).
- `POST /api/auth/phone/verify` `{ request_id, code }` → Telegram `confirmed` bilan **bir xil** javob (access/refresh token, `user`, `is_new_user`). Xatolar: `BAD_CODE` (+`attempts_left`), `CODE_EXPIRED`, `TOO_MANY_ATTEMPTS`.
- Akkaunt: raqam bo'yicha mavjud akkaunt → o'sha (Telegram bilan bir xil to'qnashuv qoidalari); yo'q → yangi akkaunt; `phone_source='sms'`.

**Provayder qatlami:** `interface SmsProvider { name: string; send(phone: string, text: string, ctx: { purpose: "login"; requestId: string }): Promise<{ ok: boolean; providerMessageId?: string; error?: string }> }`. Amalga oshirishlar: `EskizProvider` (mahalliy, taxminan 95 so'm/SMS — narxni shartnomada tekshiring), `TestProvider` (SMS ketmaydi). Tanlash env bilan (`SMS_PROVIDER`); provayderni almashtirish bitta fayl.
**Eslatma:** Eskiz'da SMS matni (ilova nomi + maqsad) oldindan **moderatsiyadan o'tishi** kerak — shablonni hoziroq tasdiqlatishni boshlang (kutish bizning nazoratimizda emas).

**Test raqamlar (tekshiruvchilar uchun):** jadval `phone_test_numbers(phone, fixed_code, enabled, note)`. Ro'yxatdagi raqamlarga **SMS yuborilmaydi**, doimiy kod qabul qilinadi. Faqat qo'lda kiritilgan raqamlar (ommaviy ro'yxat yo'q), admin panelidan yoqish/o'chirish. Play/App Store demo akkaunti shu raqamga bog'lanadi — shunda email bilan kirishni butunlay olib tashlash mumkin.

**SMS firibgarligi (pumping/bombing) va xarajatga qarshi himoya:**
- **Faqat +998** (xalqaro SMS narxi va suiiste'mol xavfi yuqori); boshqa mamlakatlar — Telegram yo'li.
- Limit: bir raqamga 3 ta/soat va 10 ta/kun; bir IP 10 ta/soat; bir `device_id` 5 ta/soat; **60 soniya cooldown**.
- **CAPTCHA** (Cloudflare Turnstile) `start` dan oldin.
- **Kunlik umumiy limit** (`platform_settings.sms_daily_cap`) va **o'chirgich** (`sms_enabled`): limitga yetsa yangi SMS yuborilmaydi, Telegram yo'li ishlayveradi; admin ogohlantiriladi.
- Kod: 6 raqam, **HMAC** bilan saqlanadi (ochiq emas), 5 daqiqa, 5 urinish, bir martalik; `start` har safar eskisini bekor qiladi.
- Taxminiy xarajat: ~1,3–1,8 SMS/foydalanuvchi × 95–200 so'm (10 000 foydalanuvchi ≈ 1,2–3,6 mln so'm).
- Har bir yuborish `sms_log` ga (raqam hash'i, vaqt, provayder javobi, narx) — hisob-kitob va anomaliyani ko'rish uchun.

**Telefon «darvozasi» (email/Google akkauntlar):** raqami yo'q akkaunt (`profiles.phone IS NULL`) uchun muhim amallarda (xarid, trener bo'lish, pul yechish) API `403 { code: "PHONE_REQUIRED" }` qaytaradi; ilova telefon/SMS yoki Telegram ulashga yo'naltiradi. Hozir **Google va email akkauntlar raqamsiz qoladi** (bu bosqichda darvoza yo'q).

---
## 10. Qarorlar va spetsifikatsiyadan farqlar
- **Mavjud `profiles.phone` aslida tasdiqlanmagan erkin matn edi** → tozalandi (zaxira `_phone_backup_v35`), ustun endi faqat tasdiqlangan raqam; profil sozlamalaridagi kiritish maydoni olib tashlandi.
- Raqam **har kirishda emas**, faqat akkauntda tasdiqlangan raqam bo'lmaganda so'raladi (§3).
- Tasdiq matniga **ikkinchi qator** («Qayerdan: …») qo'shildi.
- Raqam egasiga boshqa Telegram ulangan bo'lsa, kirish **`cancelled`** bo'ladi (polling API o'zgarmasligi uchun yangi status qo'shilmadi); sababni bot aytadi.
- Raqam formati: **E.164**; +998 uchun aniq 9 raqam; boshqa mamlakatlar ham qabul qilinadi (Telegram tasdiqlagan bo'lsa).
- Google tugmasi login/register'dagi «Boshqa usul» ostida saqlandi (Google akkauntlar raqamsiz — 2-bosqichda darvoza).
- «Telegram'ni ulash» (v47) saqlandi; uning dublikat-o'chirish qoidasi raqamni ma'lumot hisoblamaydi.

## 11. Sinov natijalari
- **SQL (real Postgres 16):** ma'lumot modeli (CHECK/UNIQUE/trigger/tarix/brauzer himoyasi/zaxira/idempotentlik), so'rov qadamlari, `tg_identify` barcha holatlari, to'qnashuv va takror sanash, ulashda raqam qoidalari, **poygalar** (bir Telegram ikki akkaunt; bir raqam ikki Telegram; bir raqam ikki foydalanuvchi ulashi; kirish va ulash bir vaqtda; kechikkan yozuv), huquqlar. **80 mutantdan 76 tasi tutildi** (4 ta ekvivalent/vaqtga bog'liq: foydalanuvchi advisory lock'i profil `FOR UPDATE` bilan, yangi akkauntda ortiqcha `ON CONFLICT`, yangi profilni `FOR UPDATE` qulflash, v34 dan saqlangan `REVOKE`). Testlar **migratsiyadagi haqiqiy xatoni** topdi (bo'sh `phone_source` CHECK'dan o'tib ketardi) — tuzatildi.
- **Regressiya:** v34 ning hamma stsenariysi v35 ustida ham o'tadi.
- **JS:** 488 test (bot: /start, kontakt, tasdiq, raqamsiz bloklash, ban, poyga; identify; profil/PUT/hisobni o'chirish; admin; maxfiylik auditi; UI; sahifalar). **138 mutantdan 135 tasi tutildi**, 3 tasi ekvivalent (ishlatilmagan o'zgaruvchi; `undefined !== son`; amalda erishib bo'lmaydigan takror-himoya).
- **TekshirilMAGAN:** haqiqiy Telegram kontakt ulashish tajribasi (klaviatura ko'rinishi, turli klientlar), haqiqiy Supabase, brauzer/ilovada vizual ko'rinish, yuklama ostida.
