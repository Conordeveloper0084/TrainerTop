# Obunachilar, TrainerTop Athlete nishoni, platforma bahosi (v18 / ZIP v10)

## Nima qo'shildi

### 1. Obunachilar — hammaga
- Oldin `follows` faqat trenerlar uchun sanalardi. Endi **oddiy foydalanuvchi (atlet) ham** obunachi to'playdi: `profiles.followers_count` (trenerda `trainer_profiles.followers_count` bilan bir vaqtda yangilanadi).
- **Profil → "Obunachilarim"**: kim obuna bo'lgan, qachon, qidiruv (ism bo'yicha), sahifalash. Trener uchun har bir obunachi yonida **"Shogird"** belgisi (uning darsligini sotib olgan bo'lsa).
- Har bir obunachi qatori **trener bo'lsa `/trainers/[id]`ga, atlet bo'lsa `/athletes/[id]`ga** olib boradi.

### 2. TrainerTop Athlete nishoni (oddiy foydalanuvchilar uchun)
- Trener nishoni (yashil, "TrainerTop Trener") va atlet nishoni (ko'k, **"TrainerTop Athlete"**) endi **ikki xil narsa** — turli rang, turli nom, turli qoida.
- **Avtomatik**: atlet `athlete_badge_min_followers` (standart **5000**, admin sozlaydigan — Sozlamalar sahifasida alohida kartochka) obunachiga yetsa nishon avtomatik beriladi. Faqat **beriladi** — avtomatik hech qachon olib tashlanmaydi.
- **Qo'lda**: Admin › Foydalanuvchilar bo'limida (faqat oddiy foydalanuvchilarga) qo'lda berish/olib tashlash mumkin. Qo'lda olib tashlangan nishon **qayta avtomatik berilmaydi** (`athlete_badge_source='revoked'` — chegaraga qayta yetsa ham tegilmaydi).
- Chegara sozlamasi o'zgartirilsa — barcha mos atletlar **darhol** tekshiriladi (`refresh_all_athlete_badges`, admin sozlamalarni saqlaganda avtomatik chaqiriladi).
- **Postlar lentasi**: har bir post muallifi yonida mos nishon (`badge_kind: "trainer" | "athlete"`) — `AthleteBadge` komponenti endi `kind` prop qabul qiladi.

### 3. Platforma bahosi (5 yulduz)
- **Profilda**: "TrainerTop ni baholang" kartochkasi — 1 foydalanuvchi = 1 baho (keyin o'zgartirish/o'chirish mumkin), izoh ixtiyoriy (≤500 belgi).
- **Bosh sahifada**: o'rtacha baho, taqsimot (5→1 yulduz), va admin **tanlab qo'ygan** (`featured`) sharhlar. Baho yo'q bo'lsa bo'lim butunlay yashirin.
- **Admin › Baholar**: barcha baholar (email bilan), filtrlar (hammasi / izohli / bosh sahifada / yashirilgan). Izohli bahoni "Bosh sahifada ko'rsatish" (feature) yoki spamni "Yashirish" mumkin.
  - Baho yoki izoh **o'zgartirilsa** — "bosh sahifada" tanlovi **avtomatik bekor bo'ladi** (admin tasdiqlagan matn foydalanuvchi tomonidan sirtdan o'zgartirib bo'lmaydi).
  - Yashirilgan baho featured qila olmaydi (avval ochish kerak). Izohsiz bahoni featured qila olmaydi.
  - Bosh sahifada ism qisqartiriladi: "Ali Karimov" → **"Ali K."**

## Qoidalar (hammasi bazada)
- Atlet nishoni **faqat** `role='user'` uchun (trenerga emas — trenerniki alohida, eski qoida bo'yicha).
- Brauzer `profiles.followers_count` / `athlete_badge*` ustunlarini **INSERT paytida ham, UPDATE paytida ham** o'ziga yoza olmaydi (`protect_profiles` trigger — ikkalasini ham tozalaydi).
- Atlet (oddiy foydalanuvchi) ham **video blog** joylay oladi (faqat `posts/` papkasiga — darslik yoki boshqa joyga video yuklay olmaydi), lekin **kunlik chegara** bilan: 10 ta post, shundan 3 tasi video (spam va saqlash xarajatidan himoya).
- Platforma bahosi: email/ID bosh sahifada hech qachon chiqmaydi, faqat qisqartirilgan ism.

## Deploy tartibi
1. Supabase → SQL Editor → `supabase/migration-v18-community.sql` (qayta ishga tushirsa xavfsiz).
   - **Mustaqil migratsiya** — v13/v15/v16/v17 (chat/e'lon/boost) bilan bog'liq emas, faqat v12 dan keyin (allaqachon ishlagan) kerak. Qaysi tartibda ham ishga tushirsa bo'ladi, boshqalarga ta'sir qilmaydi.
2. Shundan keyin kodni push qiling. Yangi env o'zgaruvchisi **kerak emas**.

Tartib buzilsa (kod SQL'dan oldin chiqsa): postlar lentasi `athlete_badge` ustunisiz **ham ishlaydi** (GET so'rovda avtomatik fallback bor — nishonsiz ko'rsatadi), boshqa hech narsa buzilmaydi.

## API
| Yo'l | Vazifasi |
|---|---|
| `POST /api/follows` | `{trainer_id}` — obuna bo'lish/bekor qilish (trener ham, atlet ham) |
| `GET /api/followers?page=&q=` | Mening obunachilarim (faqat o'zining) |
| `GET /api/athletes/[id]` | Atletning ochiq profili (trener bo'lsa `{role:"trainer"}` — sahifa qayta yo'naltiradi) |
| `GET /api/platform-reviews` | Ochiq: statistika + tanlangan sharhlar (5 daqiqa kesh) |
| `GET/PUT/DELETE /api/platform-reviews/mine` | Mening bahom |
| `GET /api/admin/platform-reviews?filter=` | Admin ro'yxati + statistika |
| `PATCH /api/admin/platform-reviews/[userId]` | `{action: feature\|unfeature\|hide\|unhide}` |
| `POST /api/admin/users/[id]/athlete-badge` | `{action: grant\|revoke}` |
| `PUT /api/admin/settings` | + `athlete_badge_min_followers` kaliti (o'zgarsa `athlete_badges_checked` qaytaradi) |

## Ilova (Android) uchun
Postlar lentasida `profiles.badge_kind` ("trainer" | "athlete") bo'yicha nishon rangini tanlang. Obunachilar/atlet profili/baholar — yuqoridagi API'lar orqali xuddi shunday ishlaydi.

## Sinov natijalari
- Haqiqiy Postgres (`t_v18.py`, v13+v15+v16+v17 zanjiri ustida): **61/61**. Eskilari buzilmagan: v12 122, v13 77, v14 64, v15 76, v16 52, v17 58, backfill 16.
- SQL mutatsion sinov: 68 ta ataylab buzilgan variant — **67 tasi ushlandi**; 1 tasi ekvivalent (`platform_review_featured`dagi `NOT hidden` sharti — jadval CHECK cheklovi `featured ⟹ NOT hidden`ni allaqachon kafolatlaydi, shu qatorni umuman yaratib bo'lmaydi).
- TS/JS: **795/795** (27 fayl), `tsc --noEmit` toza. Mutatsion sinov: 87 ta variant — **hammasi ushlandi** (1 tasi — `PlatformRatingCard` ichidagi bahosiz-saqlash himoyasi — ekvivalent: tugma `disabled` bo'lsa bosilganda handler umuman chaqirilmaydi, himoya UI orqali sinalmaydigan defense-in-depth).
- Production build muvaffaqiyatli (127 marshrut; `/athletes/[id]`, `/profile/followers`, `/admin/reviews`, `/api/athletes/[id]`, `/api/followers` — hammasi bor). Build vaqtidagi `Dynamic server usage`/`ENOTFOUND` xabarlari soxta env qiymatlaridan chiqadigan odatiy shovqin.

## Sinov jarayonida topilgan va tuzatilgan haqiqiy xato
`profile/followers/page.tsx`da har bir obunachi qatori roldan qat'i nazar doim `/athletes/[id]`ga olib borardi (trener bo'lsa ham). Amalda o'zini-o'zi tuzatardi (atlet sahifasi trenerni aniqlab `/trainers/[id]`ga qayta yo'naltiradi), lekin bu keraksiz "sakrash" edi. Endi to'g'ridan-to'g'ri rolga qarab yo'naladi.
