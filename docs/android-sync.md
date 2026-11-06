# Android ↔ Website API sinxronlash hujjati

Sana: 2026-10-30 · Asos: website kodi (ZIP v38) · Android/iOS ilovalari uchun.
**v38 da o'zgargan bo'limlar:** 0, 1.3, 1.4, 1.6, 1.8 (yangi), 4, 5, 6 (yangi).

**Qanday yozilgan.** Har bir band website KODINI o'qib (route fayllari, `lib/`, SQL migratsiyalar) yozildi.
Android bilan jonli so'rov-javob sinovi QILINMAGAN — real qurilmada tekshirilsin (ayniqsa Bearer bilan savol yuborish va push bosilishi).
JSON javob formatlari O'ZGARTIRILMAGAN. v38 da faqat QOIDALAR o'zgargan (kim yoza oladi, uzunlik limiti, xato kodlari, push) — ular ataylab belgilangan. Hali ham noto'g'ri/yarim ishlaydigan narsalar **⚠** bilan belgilangan.

---

## 0. Avval shuni o'qing (v38 holati)

1. **✅ `POST /api/lessons/{id}/questions` endi Bearer'ni qabul qiladi** (cookie yoki `Authorization: Bearer`, `getApiUser` orqali — boshqa endpointlardagidek). Android'dagi `401 "Login kerak"` xatosi shu bilan tuzatildi.
2. **Qoidalar o'zgardi (format emas):** savol yozish endi FAQAT shu darslikning **faol xaridori** yoki **treneriga** ruxsat (`403 "Savol berish uchun darslikni sotib oling"`); ban qilingan yoza olmaydi (`401`, boshqa endpointlardagidek); savol **≤ 1000 belgi** (`400`); mavjud bo'lmagan darslik endi `404` (avval `500`). Tafsilot — 1.3.
3. **Yangi push'lar:** yangi savol → trenerga, trener javob berdi → savol egasiga. `route` = **`lesson/<lessonId>`** — ilova bu route'ni HOZIRCHA BILMAYDI, Android/iOS'da qo'shilishi kerak (1.8, 4-bo'lim).
4. **Savol videoga hamon faqat sarlavha matni bilan bog'langan** (id yo'q) va **`GET` da video filtri yo'q** (1.2, 1.7). Barqaror kalit taklifi — 6-bo'lim (hali amalga oshirilmagan).
5. **Deploy:** v28 va v29 SQL production'da ishga tushganini `supabase/verify-v28-v30.sql` bilan tekshiring; tartib — `docs/questions-access-push.md`.
6. **Tuzatish (avvalgi javobimga):** chat ovozli xabar/video DAVOMIYLIGI serverda tekshiriladi (`lib/chat.ts`). Aniqrog'i — 3-bo'limda.
7. `/api/upload/init` ga `size` yuborilmasa (eski rejim) hajm limiti UMUMAN tekshirilmaydi (3.4).
---

## 1. Har bir video ostida savol-javob (`lesson_questions.video_title`)

### 1.1 Jadval (`lesson_questions`)

| Ustun | Tur | Izoh |
|---|---|---|
| `id` | uuid | savol id |
| `lesson_id` | uuid | darslik (`ON DELETE CASCADE`) |
| `user_id` | uuid | savol bergan (`profiles.id`) |
| `question` | text | savol matni (uzunlik chegarasi YO'Q) |
| `answer` | text \| null | trener javobi |
| `answered_at` | timestamptz \| null | javob vaqti |
| `created_at` | timestamptz | savol vaqti |
| `video_title` | text \| null | **v29.** `null` = umumiy darslik savoli (eski savollar shu); matn = shu video sarlavhasi (≤200 belgi) |

RLS: o'qish hamma uchun ochiq; qo'shish `auth.uid() = user_id` bo'lsa ruxsat (to'g'ridan-to'g'ri Supabase orqali ham yozish mumkin, lekin tavsiya etilmaydi — API'ning tekshiruvlarini chetlab o'tadi); yangilash faqat `service_role` (API) orqali.

### 1.2 Savollarni olish

```
GET /api/lessons/{lessonId}/questions
```
- **Auth:** shart emas (cookie/Bearer ishlatilmaydi). Login qilmagan ham, sotib olmagan ham ko'radi.
- **Query parametrlar:** YO'Q. `video_title`/video index/video id bo'yicha server filtri **yo'q**, sahifalash (`limit`/`cursor`) **yo'q**.
- **Tartib/limit:** `created_at` kamayish tartibida, **eng ko'pi 50 ta** (limit video-filtrdan OLDIN qo'llanadi: ko'p savolli darslikda ma'lum video savollari 50 tadan tashqarida qolishi mumkin).
- **Javob:** oddiy JSON massiv (`{items,...}` EMAS):

```json
[
  {
    "id": "6f1c0e52-8d3a-4b0e-9a57-2d1f0c9b7a11",
    "lesson_id": "33333333-3333-4333-8333-333333333333",
    "user_id": "11111111-1111-4111-8111-111111111111",
    "question": "Bu mashqda nafas qanday olinadi?",
    "answer": "Ko'tarishda chiqarib, tushirishda oling.",
    "answered_at": "2026-10-21T08:12:44.12+00:00",
    "created_at": "2026-10-21T07:55:10.532+00:00",
    "video_title": "Lesson 1",
    "user": { "full_name": "Ali Valiyev", "avatar_url": "https://cdn.trainertop.uz/avatars/…/img-1729….jpg" }
  },
  {
    "id": "…", "lesson_id": "…", "user_id": "…",
    "question": "Darslik qancha vaqt davom etadi?",
    "answer": null, "answered_at": null,
    "created_at": "2026-10-20T11:00:00+00:00",
    "video_title": null,
    "user": { "full_name": "O'chirilgan foydalanuvchi", "avatar_url": null }
  }
]
```
- "Kim yozgan" = `user.full_name` + `user.avatar_url` (+ `user_id`). Akkaunt o'chirilgan bo'lsa ism `"O'chirilgan foydalanuvchi"`, `avatar_url: null`.
- "Trener javobi" = `answer` + `answered_at` (javobni kim yozgani alohida maydonda yo'q — har doim shu darslikning treneri).
- **Xato holati:** baza xatosi, mavjud bo'lmagan yoki noto'g'ri `lessonId` — hammasida `200 []` (xato yashiriladi).
- Ban qilingan / bloklangan foydalanuvchilarning savollari **filtrlanmaydi** (⚠ kod bo'yicha).

**Video bo'yicha ajratish (mijoz tomonda, websiteda shunday):**
- Shu video savollari: `q.video_title === video.title`
- Umumiy savollar: `q.video_title == null`
- Websiteda `video_title` serverga `trim()` qilinib, 200 belgigacha qisqartirib saqlanadi, solishtirish esa (trim/qisqartirishsiz) `activeVideo.title` bilan — Androidda ikkala tomonni ham trim qilib, 200 belgigacha kesib solishtirish ishonchliroq.

### 1.3 Savol yuborish

```
POST /api/lessons/{lessonId}/questions
Authorization: Bearer <token>            // yoki cookie (sayt) — ikkalasi ham ishlaydi
Content-Type: application/json

{ "question": "Bu mashqda nafas qanday olinadi?", "video_title": "Lesson 1" }
```
- `question` — majburiy, `trim()` dan keyin bo'sh bo'lmasligi va **≤ 1000 belgi** bo'lishi kerak. `video_title` — ixtiyoriy matn; yo'q / bo'sh / matn emas bo'lsa `null` (umumiy savol); 200 belgidan uzun bo'lsa 200 ga kesiladi.
- **Kim yoza oladi:** shu darslikning treneri YOKI darslikda **faol xaridi** bor foydalanuvchi (`purchases.status='paid'` va umrbod yoki muddati tugamagan oylik; `expires_at` yo'q oylik — faol). Admin ham alohida imtiyozga ega emas (trener yoki xaridor bo'lmasa `403`). Platforma darsligining "treneri" — uni yaratgan admin.
- **Muvaffaqiyat: `200`** (201 emas), tanada yangi qator (`answer: null`, `answered_at: null`) + `user` obyekti — 1.2 dagi elementning aynan o'zi. Format avvalgidek.
- **Tekshiruv tartibi va xatolar:**

| # | Holat | Status | Tana |
|---|---|---|---|
| 1 | Login yo'q **yoki ban qilingan** (`getApiUser` ban'ni "kirmagan" deb hisoblaydi) | 401 | `{"message":"Login kerak"}` |
| 2 | `lessonId` UUID emas / darslik mavjud emas | **404** (avval 500) | `{"message":"Darslik topilmadi"}` |
| 3 | `question` yo'q / bo'sh / matn emas | 400 | `{"message":"Savol yozing"}` |
| 4 | `question` > 1000 belgi | **400** | `{"message":"Savol 1000 belgidan oshmasin"}` |
| 5 | Trener ham emas, faol xaridor ham emas | **403** | `{"message":"Savol berish uchun darslikni sotib oling"}` |
| 6 | Baza xatosi | 500 | `{"message":"<xom xato matni>"}` |

  (1→6 tartibda tekshiriladi: masalan xaridsiz foydalanuvchi bo'sh matn yuborsa `400`, to'g'ri matn yuborsa `403` oladi.) Ilova `message` ni foydalanuvchiga o'zgartirmay ko'rsatsa bas; `403` da "Sotib olish" tugmasini taklif qilish mumkin.
- **Push:** xaridor/foydalanuvchi savol bersa, trenerga push yuboriladi (1.8). Trener o'z darsligiga yozsa — o'ziga push yo'q.
- **Hali yo'q (kod bo'yicha):** tezlik/kunlik limit, matn filtri. (Ban tekshiruvi, sotib olganlik tekshiruvi, uzunlik limiti va bildirishnoma — v38 da qo'shildi.)

### 1.4 Trenerning javob berishi

```
PATCH /api/lessons/{lessonId}/questions/{questionId}
Authorization: Bearer <token>
{ "answer": "Ko'tarishda chiqarib, tushirishda oling." }
```
- Faqat **shu darslikning treneri** (`lessons.trainer_id`). Admin ham `403` oladi (admin javob bera olmaydi; platforma darsligida "trener" — uni yaratgan admin).
- **200:** yangilangan qator + `user` (1.2 dagidek, `answer`/`answered_at` to'ldirilgan). **Format o'zgarmagan.**
- Javobni qayta PATCH qilib **tahrirlash mumkin** (`answer` va `answered_at` almashadi).
- **Push (v38):** savol egasiga `"Savolingizga javob berildi"` push'i yuboriladi — **faqat BIRINCHI javobda**; javobni keyin tahrirlash qayta bildirishnoma yubormaydi. Trener o'z savoliga javob bersa — push yo'q.

| Holat | Status | `message` |
|---|---|---|
| Login yo'q | 401 | `Login kerak` |
| `questionId` UUID emas / savol shu darslikda yo'q | 404 | `Savol topilmadi` |
| `answer` bo'sh | 400 | `Javob yozing` |
| `answer` > 2000 belgi | 400 | `Javob 2000 belgidan oshmasin` |
| Darslik topilmadi | 404 | `Darslik topilmadi` |
| So'rovchi shu darslik treneri emas | 403 | `Faqat shu darslikning treneri javob bera oladi` |
| Boshqa xato | 500 | `Server xatolik` |

### 1.5 Tahrirlash / o'chirish
- Savolni tahrirlash — **yo'q**. Savolni o'chirish (egasi/trener/admin) — **yo'q**. Javobni o'chirish — **yo'q** (faqat qayta yozish). Admin panelda ham, universal shikoyat (report) tizimida ham `lesson_questions` uchun hech narsa topilmadi.

### 1.6 Kim ko'ra oladi / yoza oladi

| Amal | Kim |
|---|---|
| Savollarni o'qish | **Hamma** (login ham, sotib olish ham shart emas) |
| Savol yozish | **Faqat** darslik treneri yoki darslikning faol xaridori (v38; boshqalarga `403`). Ban qilingan — yo'q (`401`) |
| Javob yozish | Faqat darslik treneri |
| Websitedagi UI | Umumiy savollar bo'limi hamma uchun ko'rinadi, lekin yozish formasi faqat darslikka kirishi bor foydalanuvchiga chiqadi (boshqalarga "Savol berish uchun darslikni sotib oling"); "Shu video haqida savol" bo'limi faqat video o'ynayotganda chiqadi |

### 1.7 `video_title` bo'lmasa (eski savollar) va chekka holatlar
- Eski savollarda `video_title = null` → umumiy savol; format o'zgarmagan, faqat javobda yangi maydon paydo bo'lgan.
- **⚠ Eski Android versiya** GET javobini bitta umumiy ro'yxatda ko'rsatsa, endi unda video bo'yicha savollar ham aralash chiqadi (server ularni ajratmaydi).
- **⚠ Sarlavhasi bo'sh video:** websitedagi `playVideo` `title: v.title || "Video"` yuboradi — barcha sarlavhasiz videolar bitta `"Video"` guruhiga tushadi.
- **⚠ Bir xil sarlavhali videolar** (turli modullarda ham) savollari birga ko'rinadi.
- **⚠ Trener video sarlavhasini o'zgartirsa**, eski savollar websitedagi na video bo'limida, na umumiy bo'limda ko'rinadi (umumiy ro'yxat `video_title == null` ni, video ro'yxati aniq tenglikni ko'rsatadi) — savol bazada qoladi, lekin UI'da yo'qoladi.

### 1.8 Push bildirishnomalar (savol-javob)

Mavjud `sendPush` orqali (FCM data-xabar: `title`, `body`, `route`, `tag` — hammasi string; tafsilot `docs/push.md`):

| Hodisa | Kimga | `title` | `body` | `route` = `tag` |
|---|---|---|---|---|
| Yangi savol | darslik treneriga | `Darsligingizga yangi savol` | `"<darslik nomi (≤40 belgi)>: <savol (≤100 belgi)>"` | `lesson/<lessonId>` |
| Trener birinchi marta javob berdi | savol egasiga | `Savolingizga javob berildi` | `"<darslik nomi>: <javob (≤100 belgi)>"` | `lesson/<lessonId>` |

- **Yuborilmaydi:** yuboruvchining o'ziga (trener o'z darsligiga yozsa / o'z savoliga javob bersa); ban qilinganlarga; yuboruvchi bilan o'zaro bloklanganlarga; push sozlanmagan bo'lsa (FCM ham, Web Push ham yo'q).
- `tag` = `route`: bir darslik bo'yicha bildirishnomalar ilovada bitta bo'lib yig'iladi (oxirgisi almashtiradi).
- Push `video_title`ni olib o'tmaydi — video bo'yicha savol ham umumiy `lesson/<id>` ni ochadi.
- **⚠ Android/iOS qilishi kerak:** hozir ilova route'ni faqat `chat/<conversationId>`, `chat-group/<groupId>`, `channel` ko'rinishlarida ochadi. `lesson/<lessonId>` — YANGI: bosilganda darslik tafsiloti ekrani (`GET /api/lessons/{id}`) ochilishi kerak. Ilova bu route'ni tanimaguncha bosilganda nima bo'lishi ilovaning noma'lum-route xatti-harakatiga bog'liq (odatda ilova ochiladi, ekranga o'tmaydi) — real qurilmada tekshiring.
- **Website (PWA/Web Push):** service worker endi push `route`ni sayt manziliga o'giradi: `lesson/<id>` → `/lessons/<id>`, `chat/<id>` → `/chat?dm=<id>`, `chat-group/<id>` → `/chat?group=<id>`, `channel` → `/chat?official=1`, boshqasi → `/`. (Avval service worker `route`ni to'g'ridan-to'g'ri URL qilib ochardi — `/chat/<id>` kabi sahifalar saytda yo'q edi.)
---

## 2. Sotib olingan darsliklar — `GET /api/lessons?purchased=true`

- **Auth:** cookie YOKI `Authorization: Bearer` (`getApiUser`).
- **Login yo'q → `200` va bo'sh natija** (`401` EMAS): `[]` yoki sahifalash rejimida `{"items":[],"next_cursor":null}`.
- **Parametrlar (hammasi ixtiyoriy):**
  - `limit` (standart 20, eng ko'pi 50), `cursor` — **ikkalasidan biri berilsa javob `{items, next_cursor}` shaklida**; ikkalasi ham berilmasa **oddiy massiv** (hammasi bir yo'la).
  - `cursor` = oldingi sahifa oxirgi elementining `created_at` (ISO matn); keyingi sahifa `created_at < cursor`. Tartib: **darslikning** `created_at` kamayish tartibida (xarid sanasi bo'yicha EMAS).
  - `category`, `difficulty`, `search` (sarlavha bo'yicha, ≤100 belgi) — birga ishlaydi. `purchased=true` bo'lsa `trainer_id` va `platform` parametrlari e'tiborga olinmaydi.
- **Qaysi darsliklar kiradi:** foydalanuvchining `purchases.status='paid'` xaridlari; **muddati tugagan oylik** (`purchase_type='monthly'` va `expires_at` o'tgan) kirmaydi; `expires_at` yo'q oylik xarid faol hisoblanadi; umrbod doim kiradi. Darslik statusi cheklanmaydi (trener yashirgan/qoralamaga o'tkazgan ham chiqadi), lekin `removed` (admin olib tashlagan) va ban qilingan trener darsliklari **chiqmaydi**.
- **Element maydonlari:** `lessons` jadvalining hamma ustuni (`content` OLIB TASHLANGAN) + `profiles`. Repodagi migratsiyalar bo'yicha: `id, trainer_id, title, description, cover_image_url, price, category, difficulty, total_sales, rating, total_reviews, status, created_at, updated_at, pricing_model, price_lifetime, price_monthly, removed_at, removed_by, removed_reason, removed_prev_status` (+ `is_platform` boolean — platforma darsligi belgisi; uning migratsiyasi v30 da repoga qo'shildi). `pricing_model` qiymatlari: `"lifetime"` | `"monthly"` | `"both"`; `category` — `fitness`, `bodybuilding`, `yoga`, `powerlifting`, `diet`, `cardio`, … (`SPECIALIZATIONS` kalitlari).

```json
// ?purchased=true            → oddiy massiv
[
  {
    "id": "…", "trainer_id": "…", "title": "Testing video lessons",
    "description": "Testing comments", "cover_image_url": "https://cdn.trainertop.uz/lessons/…/img-….jpg",
    "price": 100000, "pricing_model": "both", "price_lifetime": 100000, "price_monthly": 30000,
    "category": "fitness", "difficulty": "beginner", "total_sales": 1, "rating": 5, "total_reviews": 1,
    "status": "published", "created_at": "2026-10-20T09:00:00+00:00", "updated_at": "…",
    "profiles": { "id": "…", "full_name": "Dilshod Toxirov", "avatar_url": "https://…" }
  }
]

// ?purchased=true&limit=20   → sahifalash rejimi
{ "items": [ { …yuqoridagi kabi… } ], "next_cursor": "2026-10-20T09:00:00+00:00" }   // oxirgi sahifada next_cursor: null
```
- **Ro'yxatda YO'Q:** `is_purchased`, `purchase_type`, `expires_at`, `days_left` (muddat/"30 kun qoldi" uchun) — ular faqat `GET /api/lessons/{id}` da bor (shu endpoint `Bearer`ni qabul qiladi):
  `{ …lesson, content, content_locked, is_purchased, purchase_type, expires_at, days_left }`. Faol xaridorga `content.sections[].videos[]` (`{title, description, url}`) to'liq beriladi; boshqalarga faqat sarlavhalar (`content_locked: true`).
- Xato: baza xatosi → `500 {"message": "<matn>"}`.

---

## 3. Server tomondagi yuklash limitlari (hammasi)

### 3.1 Umumiy qoidalar
- Ruxsat etilgan papkalar (`bucket`/`folder`): `avatars, posts, lessons, gyms, chat, uploads, channel`. Boshqa nom → jimgina `uploads`.
- Fayl kaliti: `<papka>/<userId>/<prefiks>-<vaqt|uuid>.<kengaytma>` (`chat/` da nomi tasodifiy UUID). Yuklash faqat login bilan (Bearer ishlaydi).
- **Video ruxsati:** `trainer`/`admin` — hamma papkaga; oddiy foydalanuvchi (`user`) — faqat `posts` papkasiga; **chat papkasiga hamma** video yuklay oladi. Aks holda `403 "Bu yerga video yuklash faqat trenerlar uchun"`.

### 3.2 Formatlar
| Tur | Qabul qilinadi |
|---|---|
| Rasm | `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif` |
| Video | `video/mp4`, `video/quicktime` (mov), `video/webm`, `video/x-m4v` |
| Ovoz (faqat `chat` papkasi, faqat `/api/upload`) | `audio/webm`, `audio/ogg`, `audio/mp4`, `audio/x-m4a`, `audio/aac`, `audio/mpeg`, `audio/wav` (`;codecs=…` qismi qirqiladi) |

### 3.3 Limitlar jadvali

| Narsa | Limit | Qayerda tekshiriladi |
|---|---|---|
| **Rasm — oddiy yuklash** (`POST /api/upload`, form-data `file` + `bucket`) | **≤ 4 MB**, aks holda `413` | server |
| **Rasm — katta** (`/api/upload/init`, `size` bilan) | **≤ 20 MB** (har qanday papka), `413` | server (faqat `size` yuborilsa) |
| Avatar | papka `avatars`, yuqoridagi rasm limitlari; `PUT /api/profile` `avatar_url` ga har qanday matn yozadi (URL tekshirilmaydi) | websitedagi klient rasmni 1600px gacha JPEG qilib siqadi — Android ham siqsin (serverda siqish yo'q) |
| Darslik muqovasi | papka `lessons`, rasm limitlari; `cover_image_url` (PUT) / `cover_url` (POST `/api/lessons`) | websitedagi klient xuddi shunday siqadi |
| Zal rasmlari | papka `gyms`; soni cheklanmagan | — |
| **Post rasmlari** | postga **≤ 5 ta**, har biri `https://` bilan boshlanadigan, ≤ 2048 belgili havola; (R2/egalik/hajm tekshirilmaydi) | server (`POST /api/posts`) |
| Post matni (`caption`) | ≤ 2000 belgi | server |
| Post: rasm + video birga | mumkin emas (`400`) | server |
| **Post videosi** | **≤ 300 MB** (`413`); turi `video/*` bo'lishi kerak; fayl `posts/<userId>/` da bo'lishi shart | init (`size` bilan) VA post yaratishda R2 `HEAD` orqali haqiqiy hajm tekshiriladi |
| Post videosi davomiyligi | 180 s (3 daqiqa) — **rad etilmaydi**, yuborilgan `video_duration` 1…180 oralig'iga qisqartirib saqlanadi | server (faqat metama'lumot) |
| Post muqovasi (`video_thumbnail_url`) | `posts/<userId>/` dagi R2 fayli bo'lishi shart | server |
| Oddiy foydalanuvchi (`role=user`) kunlik chegarasi | **10 post/kun, shundan ≤ 3 video**; oshsa `429` | server. Trener/adminga tegmaydi |
| **Darslik videosi** | **≤ 2 GB** (`413`) | init (faqat `size` yuborilsa). Davomiylik chegarasi **yo'q**. Darslik saqlashda (`POST/PUT /api/lessons`) video havolasi/hajmi tekshirilMAYDI |
| Chat: matn | ≤ 4000 belgi | server |
| Chat: rasm/video izohi | ≤ 1000 belgi | server |
| Chat: rasm | ≤ 20 MB (yuborilgan `media_size` bo'yicha) | server |
| Chat: ovozli xabar | davomiylik **majburiy**, **≤ 300 s (5 daqiqa)**; hajm **≤ 4 MB** (fayl `/api/upload` orqali yuklanadi, init ovozni qabul qilmaydi) | server — lekin `media_duration`/`media_size` MIJOZ yuborgan qiymat bo'yicha; fayl haqiqiy uzunligi/hajmi tekshirilmaydi |
| Chat: video | davomiylik **majburiy**, **≤ 120 s (2 daqiqa)**; **≤ 100 MB** (init `size` bilan va `media_size` bo'yicha) | xuddi shunday |
| Chat media havolasi | bizning R2 domeni, `chat/<yuboruvchi-userId>/…`, mos kengaytma bo'lishi shart (aks holda `400 "Fayl havolasi noto'g'ri. Faylni qayta yuklang"`) | server |
| Chat xabar yuborish endpointlari | `POST /api/chat/{conversationId}/messages`, `POST /api/chat/groups/{groupId}/messages` (tana: `type`, `content`, `media_url`, `media_mime`, `media_duration`, `media_size`, `thumb_url`) | |

(Sozlamalar manbasi: `lib/constants.ts`, `lib/chat.ts`, `app/api/upload/*`, `app/api/posts/route.ts`. `MAX_IMAGE_SIZE = 5MB` konstantasi kodda e'lon qilingan, lekin hech qayerda ishlatilmaydi.)

### 3.4 Katta fayl (multipart) shartnomasi — Android uchun muhim
1. `POST /api/upload/init` `{ fileName, fileType, folder, size }` (Bearer) → `{ uploadId, key, publicUrl, partSize, parts: [{ partNumber, url }] }`. `partSize` hozir **8 MB**; `url` — presigned PUT, **1 soat** amal qiladi.
2. Har bo'lakni `PUT <url>` bilan **to'g'ridan-to'g'ri R2'ga** yuboring (bo'lak tanasi = faylning `[(n-1)*partSize, min(n*partSize, size))` oralig'i). Javob header'idagi **`ETag`** ni (qo'shtirnoqlari bilan, o'zgartirmay) saqlang.
3. `POST /api/upload/complete` `{ uploadId, key, parts: [{ partNumber, etag }] }` → `200 { success: true, url }`.
- **Qoida:** oxirgisidan boshqa HAR BIR bo'lak **kamida 5 MiB** bo'lishi shart (R2/S3 talabi). Website shu sababli buzilgan edi (3.5 MB bo'laklar → "Upload tugatilmadi"). **Androidda bo'lak hajmini tekshiring** — serverning `partSize` qiymatidan foydalaning, o'zingizniki bilan emas.
- ⚠ `complete` har qanday xatoda (shu jumladan 5 MiB qoidasi buzilganda) umumiy `500 {"message":"Yuklashni yakunlashda xatolik"}` qaytaradi — sababi ko'rinmaydi.
- ⚠ **Eski rejim:** `size` yuborilmasa faqat `{uploadId, key, publicUrl}` qaytadi, bo'laklar `POST /api/upload/part` (form-data: `chunk`, `uploadId`, `key`, `partNumber`) orqali serverga (Vercel ~4.5 MB tana chegarasi bilan) yuboriladi va hajm limiti **umuman tekshirilmaydi**. Yangi klientlar uchun tavsiya etilmaydi.
- ⚠ Bekor qilish (abort) endpointi yo'q — to'liq yuklanmagan multipart yuklashlar R2'da qolib ketadi.
- Foydali xatolar: `401 Login kerak` · `400 fileName va fileType kerak / size noto'g'ri / Faqat MP4, MOV, WebM video yoki JPG, PNG, WebP rasm` · `403 Bu yerga video yuklash faqat trenerlar uchun` · `413 Fayl juda katta (maksimum N MB)` · `403 Ruxsat yo'q` (`key` boshqa foydalanuvchiniki).

---

## 4. So'nggi o'zgarishlar (Android/iOS ishlatadigan endpointlar)

Sanalar — ZIP ichidagi fayl vaqtlari bo'yicha taxminiy. Oxirgi 3 hafta ≈ 9–30 oktyabr; undan oldingi, lekin ilovalarga hali yetib bormagan bo'lishi mumkin bo'lgan ishlar ham kiritilgan.

### v46 — Telegram orqali kirish (batafsil: `docs/telegram-login.md`)

| O'zgarish | Android/iOS'da o'zgartirish kerakmi? |
|---|---|
| **Yangi** `POST /api/auth/telegram/start` va `GET /api/auth/telegram/status` (loginsiz); tasdiqlangach standart Supabase sessiyasi (access + refresh) bir marta beriladi; Telegram — asosiy, birinchi tugma | **Ha:** "Telegram orqali kirish" tugmasi, `tg_url` ochish, 2 s polling, sessiyani SDK'ga import qilish. Email/Google/Apple kirishlari QOLADI |
| Telegram foydalanuvchisida `GET /api/profile` → `email: null`, `login_provider: "telegram"` | **Ha:** email o'rniga "Telegram orqali kirgan" ko'rsating; email nullable bo'lishi kerak |
| `DELETE /api/account` Telegram bog'lanishini ham o'chiradi | Yo'q |
| SQL: `migration-v33-telegram-login.sql`; env: `TELEGRAM_LOGIN_BOT_TOKEN`, `TELEGRAM_LOGIN_BOT_USERNAME`, `TELEGRAM_LOGIN_WEBHOOK_SECRET`; deploy'dan keyin `setWebhook` | Server tomoni (Conor) |

### v45 — pul yechish tarixi va obunachilar (batafsil: `docs/ios-payouts-followers.md`)

| O'zgarish | Android/iOS'da o'zgartirish kerakmi? |
|---|---|
| `GET /api/payouts` — **karta endi hech qachon to'liq/shifrlangan chiqmaydi**: `card_number` endi MASKALANGAN (`•••• 1234`), yangi `card_last4`, `card_masked`, `reject_reason`; `card_number_encrypted` va `completed_by` olib tashlandi. Sahifalash: `?limit=20&cursor=` → `{items, next_cursor}` (parametrsiz — massiv, avvalgidek) | **Android:** agar `card_number` ni raqam sifatida o'qisa/formatlasa — `card_masked` ni ko'rsatsin. Yangi so'rovlarda `card_number` oldin `null` edi (karta bo'sh chiqardi) — endi to'ldirilgan |
| `GET /api/followers` — `username`, `page`, `has_more` qo'shildi (qolgani o'zgarmagan) | Ixtiyoriy; `has_more` dan foydalanish tavsiya |
| Kursorlardagi `+` (vaqt zonasi) endi bo'shliqqa aylanib ketmaydi (`posts`, `lessons`, `trainers`, `payouts`) | Mijozlar kursorni URL'ga kodlab (`+` → `%2B`) yuborgani ma'qul |

### v44 — sozlamalar, post sanoqlari, savol→guruh (batafsil: `docs/app-answers-v44.md`)

| O'zgarish | Android/iOS'da o'zgartirish kerakmi? |
|---|---|
| **Yangi** `GET /api/settings/public` → `{min_payout, default_commission_rate}` (loginsiz). Trenerning shaxsiy komissiyasi: `GET /api/trainer/earnings` → `rate`, `custom_rate`, `min_payout`; `GET /api/trainer-profile` → `commission_rate` (null = umumiy), `effective_commission` | Ixtiyoriy (pul yechish ekranida minimumni ko'rsatish uchun); server minimumni baribir `POST /api/payouts` da tekshiradi (`400 BELOW_MIN`) |
| Post sanoqlari NULL emas; `POST /api/posts/{id}/like` → `{liked, likes_count}`; `GET /api/athletes/{id}` postlarida `views_count` | Android: 0 ko'rsatilishining sababini `docs/app-answers-v44.md` §2 bo'yicha tekshirish (xom JSON log). Like javobidagi `likes_count` dan foydalanish mumkin |
| **Video savol/javobi darslik guruhiga tushadi** (yangi maydonlar `video_title`, `lesson_question_id`, `lesson_question_kind`); yangi route yo'q | iOS: belgi chizish. Android/website: o'zgarish shart emas (oddiy matn, "📹 …" qatori bilan). SQL: `migration-v32` (avval v31) |

### v42 — suhbatni "o'zim uchun o'chirish"

| O'zgarish | Android/iOS'da o'zgartirish kerakmi? |
|---|---|
| **Yangi:** `DELETE /api/chat/{conversationId}` → `200 {"success":true}` (401/404/500 — `docs/ios-backend-answers.md` §1). Faqat o'zi uchun yashiriladi; yangi xabar kelsa suhbat qaytadi, lekin faqat yangi xabarlar bilan. `GET /api/chat` va `GET /api/chat/{id}/messages` formati o'zgarmagan, lekin o'chirilgan suhbat ro'yxatda chiqmaydi, xabarlar o'chirilgandan keyingilari qaytadi | **iOS: ha** (suhbatni o'chirish; lokal keshni ham tozalash). **Android:** faqat o'chirish funksiyasi kerak bo'lsa. Mavjud ekranlar uchun o'zgarish shart emas. SQL: `migration-v31-conversation-clears.sql` (avval SQL, keyin kod) |

### v39 — ro'yxat tezligi (CDN keshi, R2 domen)

| O'zgarish | Android/iOS'da o'zgartirish kerakmi? |
|---|---|
| `GET /api/trainers` va ochiq `GET /api/lessons` (katalog, `?platform=true`, filtrlar, `limit/cursor`) endi CDN'da keshlanadi (`s-maxage=30, stale-while-revalidate=300`). JSON formati o'zgarmagan. Javobga `Server-Timing` qo'shildi | **Ha:** bu ro'yxatlarni **`Authorization` header'siz** so'rang — Vercel hujjatiga ko'ra token bo'lsa kesh ishlamaydi. Token faqat shaxsiy endpointlar uchun (`?purchased=true`, `?trainer_id=…`, `/api/lessons/{id}`, chat…). Yangi trener/darslik ~30 s (eng ko'pi ~5.5 daqiqa) kechikib ko'rinadi, ban/olib tashlash ham. Mijoz keshi avtomatik bo'lmaydi (Vercel `max-age=0` yuboradi) — ro'yxatni ilova o'zi saqlasin. |
| `/api/lessons` ochiq ro'yxatda login qilingan foydalanuvchi uchun Auth so'rovi olib tashlandi | Yo'q (faqat tezlik). |
| R2 ommaviy domeni `pub-….r2.dev` dan custom domenga (`cdn.trainertop.uz`) ko'chirilishi mumkin; bazadagi URL'lar skript bilan almashtiriladi (`docs/performance-latency-cdn.md` §4) | **Ha:** media URL'larini qattiq kodlamang (faqat API javobidagi URL'ni ishlating), `r2.dev` ga bog'lanib qolmang; ko'chirishdan keyin lokal keshdagi eski URL'lar yangilansin. |

### v38 (30 okt) — savol-javobni mustahkamlash

| O'zgarish | Android/iOS'da o'zgartirish kerakmi? |
|---|---|
| `POST /api/lessons/{id}/questions` — **Bearer qabul qilinadi** (avval faqat cookie → 401) | **Android: Ha, qayta sinab ko'ring.** Agar savolni boshqa yo'l bilan (masalan Supabase'ga to'g'ridan-to'g'ri insert) yuborib turgan bo'lsa — API'ga o'ting: u endi sotib olganlik/ban/uzunlikni tekshiradi, to'g'ridan-to'g'ri insert esa shularni chetlab o'tadi. **iOS:** xuddi shunday. |
| Xuddi shu endpoint: yangi **`403`** ("Savol berish uchun darslikni sotib oling"), **`400`** (> 1000 belgi), **`404`** (darslik yo'q; avval `500`) | **Ha:** `403` matnini ko'rsating (+ "Sotib olish"), kiritish maydoniga 1000 belgi limiti qo'ying, sotib olmagan foydalanuvchiga savol formasini yashiring (`GET /api/lessons/{id}` dagi `is_purchased`/trener bo'lish bo'yicha). Javob formati (200) o'zgarmagan. |
| Push: yangi savol → trener; birinchi javob → savol egasi; **`route = lesson/<lessonId>`** (1.8) | **Ha:** push bosilganda `lesson/<id>` ni darslik ekrani sifatida ochish. Trenerga bu push'lar faqat u ilovada tizimga kirgan va `POST /api/devices` bilan token yuborgan bo'lsa keladi (mavjud mexanizm). |
| `PATCH .../questions/{id}` — format o'zgarmadi, faqat birinchi javobda push qo'shildi | Yo'q (faqat yuqoridagi push route). |
| `GET .../questions` — o'zgarmadi | Yo'q. |
| Website: service worker push route'ni sayt manziliga o'giradi; chat sahifasi `?dm=<suhbat id>` ni ochadi; `isPushConfigured` endi FCM YOKI Web Push sozlangan bo'lsa true | Yo'q (faqat website/backend). |
| SQL: `migration-v30-lessons-is-platform.sql` (`lessons.is_platform`) | Yo'q (API o'zgarmagan). Production'da ustun allaqachon bor — migratsiya uni o'zgartirmaydi. |

### Oxirgi 3 hafta ichida (v34–v36)

| Sana | O'zgarish | Android'da o'zgartirish kerakmi? |
|---|---|---|
| ~21 okt | **Yangi:** `GET /api/lessons?purchased=true` (2-bo'lim) | **Ha, agar** "Sotib olinganlar" ekrani yo'q yoki o'zi boshqacha yig'ayotgan bo'lsa — endi bitta so'rov yetadi; muddat (`days_left`) uchun har bir darslikning `GET /api/lessons/{id}` si kerak. Aks holda — yo'q. |
| ~21 okt | **Yangi maydon:** savol javobida `video_title`; `POST .../questions` `video_title` qabul qiladi (1-bo'lim) | **Ha (tavsiya):** hozirgi Android savollarni bitta ro'yxatda ko'rsatsa, endi unda video savollari aralash chiqadi — `video_title == null` bo'yicha ajrating yoki video bo'yicha guruhlang. Savol yuborish endi Bearer bilan ishlaydi (v38, yuqoriga qarang). |
| ~21 okt | Server upload kodi **o'zgarmadi**; website klienti presigned (to'g'ri R2) yo'liga o'tkazildi (3.4) | **Tekshirish kerak:** Android darslik/post videosini bo'laklab yuklaydimi va bo'lak ≥ 5 MiB mi? Bitta bo'lak yoki `partSize` bo'yicha bo'lsa — yo'q. |
| ~21 okt | Website UI: darslik ko'rish sahifasi (YouTube uslubi, avtomatik skroll, oldingi/keyingi) | Yo'q (API o'zgarmagan). Faqat UX namuna sifatida. |

### 3 haftadan sal oldin (Android'ga yetmagan bo'lishi mumkin)

| Sana | O'zgarish | Android'da o'zgartirish kerakmi? |
|---|---|---|
| ~8 okt | `POST /api/devices`: `platform: "web"` + `keys {p256dh, auth}` qo'shildi; token chegarasi 1024 → 2048; `device_tokens.web_push_keys` ustuni (v28); `sendPush` endi FCM + Web Push ikkalasiga yuboradi | **Yo'q.** Android so'rovi (`{token, platform:"android"}`) o'zgarmagan, FCM `data` xabar formati (`title/body/route/tag`) bir xil. **Shart:** v28 SQL ishga tushirilgan bo'lsin (`supabase/verify-v28-v30.sql` bilan tekshiring). |
| ~4 okt | `GET /api/trainers` va `GET /api/trainers/{id}`: endi `profiles.role = 'trainer'` ham shart (roli oddiy foydalanuvchiga qaytgan akkauntlar karta bo'lib chiqib qolardi). Sahifalash (cursor) buzilmagan — filtr sahifalashdan oldin bajariladi. `{id}` javobida trener bo'lmasa: `is_trainer:false`, trenerga xos maydonlar yo'q, `profiles` = `{id, full_name, avatar_url, username, role, created_at}` (trener bo'lsa `role` kirmaydi) | **Yo'q**, agar Android `is_trainer:false` holatini allaqachon to'g'ri ishlasa. Ro'yxatda o'zgarish o'z-o'zidan ta'sir qiladi. |
| ~3 okt | Trener pul yechish kartasini (ixtiyoriy) shifrlab saqlash: `GET/PUT/DELETE /api/trainer/payout-card`; `POST /api/payouts` da `save_card` / `use_saved_card`; `DELETE /api/account` saqlangan kartani ham o'chiradi. To'liq format: `docs/payout-card.md` | **Faqat agar** appda pul yechish ekrani bo'lsa (Android chati so'ragan edi). Boshqa hollarda — yo'q. v26 SQL + `PAYOUT_CARD_KEY` env kerak. |
| ~2–3 okt | Website sahifalari: `/privacy`, `/terms`, `/delete-account` (Play siyosati) | API emas. Appda "Hisobni o'chirish" havolasi `https://www.trainertop.uz/delete-account` ga ko'rsatsin (yoki `DELETE /api/account`). |
| ~4 okt | Admin endpointlari (hisob/kontentni tozalash) — faqat admin, faqat website | Yo'q (Android'da admin yo'q). |
| ~8 okt | PWA, service worker, o'rnatish oynasi — faqat website | Yo'q. |

**O'zgarmagan:** `/api/upload*`, `/api/lessons/{id}`, `/api/chat/*`, `/api/posts` server kodi shu davrda tegilmagan.

---

## 5. Hali qurilmagan yoki noto'g'ri ishlaydigan narsalar (alohida)

**v38 da hal qilingan:** Bearer bilan savol yuborish; sotib olmaganlarning yozishi; ban tekshiruvi; uzunlik limiti; savol/javob bildirishnomalari; `lessons.is_platform` migratsiyasi (v30); push bosilganda web'da noto'g'ri sahifa ochilishi.

**Hali ochiq:**
1. **⚠ Savol↔video bog'lanishi sarlavha matniga tayanadi** (1.7): bo'sh/takroriy sarlavhalar aralashadi, sarlavha o'zgarsa savollar UI'dan "yo'qoladi". Barqaror yechim — 6-bo'lim (taklif, amalga oshirilmagan).
2. **⚠ Savollarni olish:** hamma savol aralash, eng ko'pi 50 ta; video filtri va sahifalash yo'q; ban qilingan/bloklangan foydalanuvchilar savollari filtrlanmaydi. Savolni tahrirlash/o'chirish/shikoyat qilish yo'q.
3. **⚠ Yuklash:** `size`siz init hajmni tekshirmaydi; `complete` xato sababini yashiradi; abort yo'q; chat davomiylik/hajm — mijoz bergan qiymatga ishonadi (post videosidan farqli, u R2 `HEAD` bilan tekshiriladi); post rasm havolalari tekshirilmaydi; darslik videosi havolalari saqlashda tekshirilmaydi.
4. **⚠ `lesson/<id>` push route'ini Android/iOS hali bilmaydi** (1.8) — ilovalarda qo'shilmaguncha bosilganda ekranga o'tmasligi mumkin.
5. **Deploy tartibi:** SQL → keyin kod (`docs/questions-access-push.md`). Production'da v28/v29 bajarilganini `supabase/verify-v28-v30.sql` bilan tasdiqlang.
6. **Aniqlashtirishlar (avvalgi javoblarimga):** (a) chat davomiylik limitlari serverda tekshiriladi, "faqat frontendda" degani xato edi; (b) post videosining 300 MB limiti nafaqat yuklash boshida, post yaratishda ham haqiqiy hajm bo'yicha tekshiriladi.
---

## 6. Taklif (AMALGA OSHIRILMAGAN): savolni videoga barqaror kalit bilan bog'lash

**Muammo.** Hozir bog'lanish `lesson_questions.video_title` (matn). Videoda id yo'q (`content.sections[].videos[]` = `{title, description, url}`), shuning uchun: bo'sh sarlavhalar `"Video"` ga yig'iladi, bir xil nomlilar aralashadi, sarlavha o'zgarsa savollar UI'dan yo'qoladi.

**Variantlar**

| Variant | Kalit | Afzallik | Kamchilik |
|---|---|---|---|
| A (tavsiya) | Serverda berilgan doimiy `videos[].id` (uuid) + `lesson_questions.video_id text` | Qayta tartiblash, nomini o'zgartirish, bir xil nom — hammasi xavfsiz; eng aniq | Kontentga id qo'shish va eski ma'lumotni to'ldirish (backfill) kerak |
| B | `video_key = hash(video url)`, kontent o'zgarmaydi | Migratsiya sodda, kontentga tegilmaydi | URL almashsa (qayta yuklash/YouTube havolasi o'zgarsa) savollar yo'qoladi — bu qisman to'g'ri ("yangi video") lekin trener xatosini ham jazolaydi |
| C | Tartib raqami (`sectionIndex:videoIndex`) | Eng oson | Qayta tartiblash yoki video qo'shish/o'chirishda savollar BOSHQA videoga ko'chadi — eng xavfli, tavsiya etilmaydi |

**A varianti — reja (additive, eski klientlar buzilmaydi):**
1. **Sxema:** `ALTER TABLE lesson_questions ADD COLUMN video_id text` (nullable) + indeks `(lesson_id, video_id)`. `video_title` saqlanadi.
2. **Id berish:** darslik saqlanganda (`POST/PUT /api/lessons`, admin POST/PUT) server har bir videoga `id` beradi; klient id yuborsa — saqlanadi, yubormasa — avvalgi versiyadan **`url` bo'yicha moslashtirilib** id ko'chiriladi (shunda tahrirlashda id yo'qolmaydi), yangi URL = yangi id. `GET /api/lessons/{id}` javobida `videos[].id` qo'shimcha maydon bo'lib chiqadi (eski klientlar e'tibor bermaydi).
3. **Backfill:** mavjud darsliklarga bir martalik id berish; mavjud savollarni `video_title` bo'yicha o'sha darslik ichida **bitta** videoga mos kelsa `video_id` ga bog'lash, mos kelmasa/bir nechta bo'lsa `video_id = null` (umumiy ro'yxatda qoladi, yo'qolmaydi).
4. **API (qo'shimcha, mavjudlari o'zgarmaydi):** `POST` `video_id` ni (afzal) yoki `video_title` ni qabul qiladi; `GET` javobiga `video_id` qo'shiladi va ixtiyoriy `?video_id=` filtri hamda `limit/cursor` sahifalash (50 ta chegarasi video savollarini yutib yubormasligi uchun).
5. **Klientlar:** yangi versiyalar `video_id` yuboradi/filtrlaydi; eski versiyalar `video_title` bilan ishlashda davom etadi. Barcha klientlar yangilangach `video_title` bo'yicha moslash o'chiriladi.
6. **Xavflar/xarajat:** kontent JSON'iga tegish (trener tahriri bilan poyga holati: id'ni faqat serverda berish bilan hal bo'ladi); backfill'da noaniq moslashuvlar; website + 2 ilova birgalikda yangilanishi kerak. Taxminiy hajm: 1 migratsiya + 4 route + website UI; ilovalarda kichik.

Qaror kelgunga qadar mavjud xatti-harakat (sarlavha bo'yicha) o'zgarmaydi.
