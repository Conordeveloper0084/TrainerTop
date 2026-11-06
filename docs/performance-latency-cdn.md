# Ro'yxat so'rovlari sekinligi: region, CDN keshi, R2 custom domen (v39)

Sabab: iOS ilovada `/api/trainers?limit=20` birinchi marta 2.3 s, keyin 0.7–0.8 s.

> **Nima o'lchandi va nima o'lchanMAGAN.** Men production'ga ulana olmayman, shuning uchun hech qanday haqiqiy
> kechikish o'lchamadim. Quyida: (a) KOD va rasmiy hujjatlardan tekshirilgan faktlar, (b) shu faktlardan kelib chiqqan
> tahlil, (c) o'zingiz 5 daqiqada o'lchay oladigan buyruqlar. Tezlashish miqdorini va'da qilmayman — deploy'dan keyin
> 3-bo'limdagi buyruqlar bilan o'lchab ko'ring.

## 0. Qisqa xulosa

| # | Topilma | Holat |
|---|---|---|
| 1 | `vercel.json` da `regions` YO'Q → Vercel hujjatiga ko'ra yangi loyihalarda funksiyalar **Washington, D.C. (`iad1`)** da ishlaydi (agar dashboard'da o'zgartirmagan bo'lsangiz). Supabase hududi esa kodda ko'rinmaydi. | **Siz tekshirasiz** (1-bo'lim) — qaror Supabase hududiga bog'liq |
| 2 | Ommaviy ro'yxatlarda CDN keshi yo'q edi | **Qilindi:** `/api/trainers`, ochiq `/api/lessons` → `s-maxage=30, stale-while-revalidate=300`. Foydalanuvchiga bog'liq javoblar ataylab keshlanmadi (2-bo'lim) |
| 3 | `/api/lessons` login qilgan foydalanuvchida har so'rovda Supabase Auth'ga (+ban so'roviga) ortiqcha tarmoq so'rovi yuborardi, garchi ochiq ro'yxatga kerak bo'lmasa ham | **Qilindi:** faqat `purchased=true` / `trainer_id=…` da so'raladi |
| 4 | Rasmlar `pub-….r2.dev` dan: Cloudflare hujjatiga ko'ra ishlab chiqarish uchun EMAS — tezligi/so'rov soni cheklanadi (`429`), keshlash va bot-himoya yo'q | **Kod tayyorlandi** (eski va yangi domen birga ishlaydi, URL ko'chirish skripti). Cloudflare'dagi qadamlarni **siz** bajarasiz (4-bo'lim) |
| 5 | Kechikishni bo'lib ko'rish imkoni yo'q edi | **Qilindi:** shu ikki endpointda `Server-Timing: db;dur=…, total;dur=…` (3-bo'lim) |

**⚠ Eng muhim ogohlantirish (iOS/Android uchun):** Vercel hujjatiga ko'ra so'rovda `Authorization` header bo'lsa CDN keshi **umuman ishlamaydi**. Ilova ommaviy ro'yxatlarni (`/api/trainers`, `/api/lessons` katalog/platforma) **token'siz** so'rashi kerak — aks holda 2-bo'limdagi kesh iOS uchun foyda bermaydi.

---

## 1. Hudud (region): Vercel funksiyalari va Supabase

**Tekshirilgan fakt.** Vercel hujjati: funksiyalar sukut bo'yicha *Washington, D.C. (`iad1`)* da ishlaydi; hudud `vercel.json` dagi `"regions"` yoki dashboard (Project Settings → Functions → Function Region) orqali o'zgartiriladi; Hobby — bitta region, Pro — 5 tagacha. Sizning `vercel.json` da faqat `crons` bor, `regions` yo'q.

**Nega bu muhim:** har bir API so'rovida funksiya Supabase'ga 1–3 marta ketma-ket murojaat qiladi (ban ro'yxati — instansiyada 30 s keshlanadi; keyin asosiy so'rov; ba'zi endpointlarda Auth). Telefon → funksiya masofasi so'rovda **bir marta** o'tiladi, funksiya → baza masofasi esa **har bir** ketma-ket so'rovda. Shuning uchun asosiy qoida:

> **Funksiya hududi = Supabase hududi.** Foydalanuvchiga yaqinlik ikkinchi darajali.

Misol: Supabase Yevropada (masalan Frankfurt), funksiyalar esa `iad1` da bo'lsa — har bir DB so'rovi Atlantikadan o'tadi. Aksincha, Supabase AQSh sharqida bo'lsa-yu funksiyani `fra1` ga ko'chirsangiz, **sekinlashadi** (har DB so'rovi okeandan o'tadi) — bu holda hudud o'zgartirilmaydi.

**Tekshirish (2 daqiqa):**
1. **Supabase hududi:** Supabase Dashboard → Project Settings → General (yoki Infrastructure) → *Region*. Yoki Connect dialogidagi host (`aws-0-<region>.pooler.supabase.com`).
2. **Funksiya hududi (haqiqatda):** `curl -sI "https://www.trainertop.uz/api/trainers?limit=1" | grep -i x-vercel-id` → javob `fra1::iad1::abcde-…` ko'rinishida: **birinchisi** — so'rovni qabul qilgan CDN uzeli, **ikkinchisi** — funksiya bajarilgan region. (Kesh `HIT` bo'lsa funksiya bajarilmaydi — 2-ustun bo'sh/boshqacha bo'lishi mumkin; shunda `?limit=1&x=<tasodifiy>` bilan keshni chetlab o'ting.)
3. Ikkalasi mos kelmasa — funksiya hududini Supabase'ga moslang.

**O'zgartirish (qayta deploy kerak emas, dashboard orqali):** Vercel → Project → Settings → Functions → *Function Region* → Supabase'ga eng yaqinini tanlang → keyingi deploy'dan kuchga kiradi. Yoki `vercel.json` ga `"regions": ["fra1"]` (qiymat — Supabase hududiga qarab). Men `vercel.json` ga hudud YOZMADIM: Supabase hududini bilmay turib taxmin qilish xavfli.

> Pro rejada bir nechta region mumkin, lekin bazangiz bitta hududda — funksiyani bir nechta regionga yoyish baza bilan masofani YOMONLASHTIRADI. Bitta region (bazaniki) qoldiring.

## 2. CDN keshi (`Cache-Control: s-maxage=30, stale-while-revalidate=300`)

**Qaysi endpointlar keshlandi** (hammasi — hamma ko'ruvchiga bir xil javob):
- `GET /api/trainers` (oddiy va `?limit/cursor/search/city/...` variantlari; URL — kesh kaliti)
- `GET /api/lessons` ochiq variantlari: katalog, `?platform=true`, `category/difficulty/search/limit/cursor`

(`/api/trainers/featured` allaqachon `s-maxage=300` bilan keshlangan edi.)

**Ataylab keshlanMAGANlar va sababi:**
| Endpoint | Sabab |
|---|---|
| `GET /api/posts` | Javob foydalanuvchiga bog'liq (`is_liked`, o'zi bloklaganlarning postlari yashirilishi). Vercel keshi cookie'ni kalit qilmaydi → bitta odamning lentasi boshqasiga berilib qolardi |
| `GET /api/lessons?purchased=true`, `?trainer_id=…` | Sotib olinganlar / egasi qoralamalarni ko'radi — shaxsiy |
| `GET /api/lessons/[id]`, `GET /api/trainers/[id]` | `is_purchased`/pullik kontent, `isFollowing` — shaxsiy; detal allaqachon `private, no-store` |
| Xato javoblari (`500`) | Hech qachon keshlanmaydi |

**Bilib qo'yish kerak bo'lgan cheklovlar:**
1. **`Authorization` header → kesh yo'q** (Vercel hujjati). iOS/Android ommaviy ro'yxatlarni token'siz yuborishi kerak. Token faqat shaxsiy endpointlar uchun.
2. **Ilova tomonida avtomatik kesh bo'lmaydi:** Vercel `s-maxage` ni olib tashlab, mijozga `public, max-age=0, must-revalidate` yuboradi. Ilova ro'yxatni o'zi saqlasin (oxirgi ro'yxatni darhol ko'rsatib, orqada yangilash).
3. **Yangilanish kechikishi:** yangi trener/darslik odatda ~30 s ichida, eng noqulay holatda (`stale-while-revalidate` davrida) ~5.5 daqiqagacha ko'rinadi. **Ban qilish va olib tashlash ham ro'yxatlarda shuncha kechikib aks etadi** (bunga instansiyadagi mavjud 30 s ban keshi qo'shiladi). Zudlik bilan yo'qolishi shart bo'lgan kontent bo'lsa — keshni o'chiring yoki `s-maxage`/`stale-while-revalidate` ni kamaytiring (`src/lib/http-cache.ts`, bitta joy).
4. Keshlangan javobda `Server-Timing` — keshlangan (birinchi hisoblangan) so'rovniki.

**Tekshirish:**
```
curl -sI "https://www.trainertop.uz/api/trainers?limit=20" | grep -iE "x-vercel-cache|cache-control|server-timing|age"
```
Birinchi so'rov `x-vercel-cache: MISS`, 30 s ichidagi keyingisi `HIT`. Agar `Authorization` yuborsangiz — `HIT` bo'lmaydi (kutilgan).

## 3. Kechikishni bo'lib ko'rish

```
curl -s -o /dev/null -w "dns:%{time_namelookup}  connect:%{time_connect}  tls:%{time_appconnect}  ttfb:%{time_starttransfer}  jami:%{time_total}\n" "https://www.trainertop.uz/api/trainers?limit=20&x=$RANDOM"
curl -sI "https://www.trainertop.uz/api/trainers?limit=20&x=$RANDOM" | grep -iE "x-vercel-id|x-vercel-cache|server-timing"
```
(`x=$RANDOM` keshni chetlab o'tadi — funksiyaning o'zini o'lchash uchun.) 3 marta takrorlang, birinchisini alohida yozing.

| Ko'rsatkich | Nimani bildiradi |
|---|---|
| `dns + connect + tls` | tarmoq/edge ulanishi (birinchi so'rovda yuqori — sovuq ulanish) |
| `Server-Timing: total` | funksiyaning o'zi ishlagan vaqt (cold start va tarmoq KIRMAYDI) |
| `Server-Timing: db` | `total` ning bazaga ketgan qismi. `db` ≈ `total` va yuzlab ms bo'lsa → funksiya↔Supabase masofasi (1-bo'lim) |
| `ttfb − total` | funksiyagacha yo'l + cold start. Birinchi so'rovda katta farq → cold start / sovuq ulanish |

Birinchi 2.3 s → keyingi 0.7–0.8 s farqi odatda sovuq ulanish (DNS/TLS) va funksiya cold start'iga to'g'ri keladi; CDN keshi (agar token yuborilmasa) funksiyaga umuman bormaslikni ta'minlaydi, `stale-while-revalidate` esa kesh muddati tugagach ham foydalanuvchini kutdirmaydi.

## 4. R2 custom domen (`cdn.trainertop.uz`)

**Tekshirilgan fakt (Cloudflare hujjati):** `r2.dev` — faqat sinov uchun; so'rov soni va o'tkazish tezligi cheklanadi (limitdan oshsa `429`); keshlash, bot-himoya va URL-tahlil faqat custom domen bilan ishlaydi. Custom domen uchun domen zonasi **sizning Cloudflare hisobingizda** bo'lishi shart.

### 4.1 Siz bajarasiz (Cloudflare / DNS) — kodda qilib bo'lmaydi
**Variant A — `cdn.trainertop.uz`:** `trainertop.uz` zonasini Cloudflare'ga qo'shish (nameserver'larni .uz registratorida Cloudflare'nikiga almashtirish). Xavf: butun domenning DNS'i Cloudflare'ga o'tadi — hozirgi BARCHA yozuvlar (Vercel `A/CNAME`, pochta/TXT va h.k.) Cloudflare'da AYNAN takrorlanishi kerak, Vercel yozuvlari **"DNS only"** (kulrang bulut) bo'lishi kerak. Almashtirishdan oldin yozuvlar ro'yxatini nusxalab oling. *Cloudflare `.uz` zonasini qabul qilishi men tomondan tekshirilmagan — "Add a site" da sinab ko'ring.*
**Variant B — alohida domen:** faqat media uchun boshqa domen (masalan `trainertop-cdn.com`) Cloudflare'da; asosiy sayt DNS'iga tegilmaydi (xavfsiz, lekin `cdn.trainertop.uz` brendi bo'lmaydi). *Subdomen uchun "CNAME/partial setup" odatda pullik rejalarda — tekshirilmagan.*

Keyin: Cloudflare → R2 → bucket → Settings → **Custom Domains → Connect Domain** → `cdn.trainertop.uz`. Tekshiring: `https://cdn.trainertop.uz/<mavjud key>` ochiladi, ikkinchi so'rovda `cf-cache-status: HIT`. (Obyektlarga yuklashda `Cache-Control: public, max-age=31536000` qo'yilgan — Cloudflare shunga amal qiladi. Juda katta darslik videolari Cloudflare keshiga tushmasligi mumkin — fayl hajmi chegarasi tarifga bog'liq; R2 chiqish trafigi bepul bo'lgani uchun bu xarajat emas, faqat tezlik masalasi.)

### 4.2 Kod tayyorligi (v39 da qilindi)
- `R2_PUBLIC_URL` — yangi yuklashlar qaytaradigan bazaviy URL (o'zgartirilgach yangi URL'lar `cdn…` bilan chiqadi).
- **Yangi env `R2_LEGACY_PUBLIC_URLS`** (vergul bilan): eski bazaviy URL(lar), masalan `https://pub-xxxx.r2.dev`. Bazadagi ESKI URL'lar ishlashda davom etishi uchun: egalik/tozalash tekshiruvlari (`keyFromPublicUrl` — chat media, post video, hisobni o'chirishda R2 tozalash) ikkala domenni tanib oladi. Busiz domen almashgach eski URL'lar uchun R2 fayllarini o'chirish/tekshirish jimgina ishlamay qoladi.
- `next.config.js`: `R2_PUBLIC_URL` va `R2_LEGACY_PUBLIC_URLS` host'lari `next/image` uchun avtomatik ruxsat etiladi (qo'lda tahrir shart emas).
- R2 CORS (`r2-cors.json`) o'zgarmaydi: presigned yuklash S3 endpoint'iga ketadi, custom domenga emas.

### 4.3 Bazadagi URL'larni ko'chirish — `supabase/rewrite-media-urls.sql`
Rasm/video URL'lari bazada TO'LIQ manzil bilan saqlanadi; custom domen ulangach ham eski yozuvlar `r2.dev` dan berilaveradi. Skript ularni ko'chiradi: `profiles.avatar_url`, `lessons.cover_image_url`, `lessons.content` (JSON ichidagi video URL'lar), `posts.images/video_url/video_thumbnail_url`, `trainer_profiles.gym_photos`, `chat_groups/channel_settings.avatar_url`, `announcements.*`, `messages.*`.
- **Avval ko'rish rejimi** (`apply = false`, standart): hech narsa o'zgarmaydi, jadval/ustun bo'yicha qator soni chiqadi.
- Faqat `<old_base>/` bilan boshlanadiganlar o'zgaradi (tashqi havolalar va `…r2.dev.evil.com` kabi o'xshash prefikslar tegilmaydi); bitta tranzaksiya (xato → hammasi bekor); qayta ishga tushirsa 0 qator; `old/new` ni almashtirsangiz — **teskari ko'chirish**; `only_tables` bilan jadvalma-jadval.
- Hisobga OLINMAYDI (tarixiy surat/jurnal): `reports.snapshot`, `chat_reports.snapshot`, `notifications.data`, `admin_audit_log.details`, `chat_group_analyses.result`. **Production'da repodagi migratsiyalarda yo'q qo'shimcha ustunlar bo'lsa — ular ham tekshirilsin** (skript faqat repodagi sxemani biladi).
- `messages` yangilanishi Realtime'ga UPDATE hodisalari yuboradi — kam trafikli vaqtda, alohida (`only_tables := ARRAY['messages']`) bajaring. Backup oling.

### 4.4 Ko'chirish tartibi
1. Cloudflare'da custom domen ulang va `https://cdn…/<key>` ishlashini tekshiring (4.1). **`r2.dev` ni hozir O'CHIRMANG.**
2. Vercel env: `R2_LEGACY_PUBLIC_URLS=https://pub-xxxx.r2.dev` (eski) va `R2_PUBLIC_URL=https://cdn.trainertop.uz` (yangi) → kodni deploy qiling.
3. Yangi yuklangan fayl URL'i `cdn…` bilan chiqishini tekshiring.
4. Backup → `rewrite-media-urls.sql` ni **ko'rish rejimida** ishga tushiring → sonlarni ko'ring → `apply = true`.
5. Android/iOS: URL'larni qattiq kodlamasligi va eski URL'larni lokal keshdan chiqarishini tekshiring (ro'yxatlar yangilangach yangi URL'lar keladi).
6. Cloudflare R2 metrikasida `r2.dev` trafigi to'xtaganiga ishonch hosil qilgach (bir necha hafta), `r2.dev` ni o'chiring va `R2_LEGACY_PUBLIC_URLS` ni olib tashlang.

**Orqaga qaytish:** skriptni `old/new` almashtirib ishga tushiring; env'ni qaytaring. `r2.dev` yoqilgan ekan, ikkala tomonga ham o'tish xavfsiz.

## 5. Ko'rib chiqilgan, lekin QILINMAGAN (ongli ravishda)
- `/api/trainers` bazadan **hamma** e'lon qilingan trenerni oladi va sahifalashni xotirada bajaradi (filtr/qidiruv shu tufayli). Hozir trenerlar kam — muammo emas; yuzlab trener bo'lganda DB-tomon sahifalashga o'tish kerak. Kesh buni ham yengillashtiradi.
- Cron `/api/health` kuniga bir marta — funksiyani "isitmaydi" (cold start'ga ta'sir qilmaydi).
- Katta rasmlar: serverda rasmni kichraytirish yo'q (faqat websitedagi klient 1600px gacha siqadi). Ilova ro'yxat uchun to'liq o'lchamli rasm yuklayotgan bo'lishi mumkin — ro'yxat kartochkalari uchun kichik rasm (thumbnail) alohida masala.
- `/api/posts` lentasini keshlash — foydalanuvchiga bog'liqligi sababli oddiy `s-maxage` bilan mumkin emas (2-bo'lim).

## 6. Deploy tartibi
1. (Ixtiyoriy, tavsiya) 1-bo'lim: hududni tekshiring/moslang — bu alohida, kod talab qilmaydi.
2. Kodni deploy qiling (yangi env majburiy emas). `curl` bilan 2- va 3-bo'limdagi tekshiruvlarni bajaring.
3. iOS/Android: ommaviy ro'yxatlarni token'siz so'rang.
4. R2 custom domen: 4.4 tartibida (alohida kun/oyna).

## 7. Sinov natijalari
JS: 4 ta yangi test fayli, 35 test — kesh/`Server-Timing` yordamchisi 6; `/api/trainers` + `/api/lessons` kesh qoidalari va aniq `Server-Timing` qiymatlari 15; `keyFromPublicUrl`/legacy URL 11; `next.config` host'lari 3. To'liq to'plam 129/129, `tsc` toza, production build o'tdi.
Mutatsiya: **43 ta mutantdan 41 tasi tutildi**, 2 tasi haqiqiy ekvivalent (xatti-harakatni o'zgartirmaydi): (1) `/api/lessons` da ko'ruvchi kerak bo'lmaganda `user` qiymati hech qayerda o'qilmaydi; (2) `keyFromPublicUrl` da bo'sh bazaviy URL'ni `.filter(Boolean)` bilan tashlash — undan keyingi `if (!base) return null` tekshiruvi bir xil natija beradi (ikki qavatli himoya).
SQL (real Postgres 16, v3→v30 zanjiri, 16 ustun/jadval seed qilingan): ko'rish rejimi ma'lumotni o'zgartirmaydi; apply to'g'ri (matn, `text[]` tartibi saqlanadi, JSON ichidagi URL'lar; tashqi va o'xshash-prefiksli URL'lar tegilmaydi); qayta ishga tushirish 0 qator; teskari ko'chirish asl holatni tiklaydi; `only_tables`; noto'g'ri parametrlar rad etiladi; mavjud bo'lmagan ustun o'tkazib yuboriladi; xato bo'lsa hammasi bekor (atomiklik). Sinov davomida haqiqiy xato topildi va tuzatildi (UNION ichidagi `ORDER BY`).

**TekshirilMAGAN:** production'dagi haqiqiy kechikish va tezlashish miqdori; Supabase/Vercel haqiqiy hududlari; Cloudflare'ning `.uz` zonasini qabul qilishi; `x-vercel-cache: HIT` ning production'da kutilganidek ishlashi (kod va Vercel hujjati bo'yicha asoslangan, lekin jonli so'rov bilan tasdiqlanmagan).
