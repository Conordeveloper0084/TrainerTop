# Ilovalar uchun javoblar: sozlamalar/komissiya, post sanoqlari, savol→guruh (v44)

Hammasi KODNI o'qib yozilgan (yo'llar ko'rsatilgan); jonli qurilmada/production'da sinalmagan joylar oxirida.

---
## 1) Platforma sozlamalari, komissiya, minimal yechish

**Sozlamalar qayerda:** `platform_settings` jadvali (`key`, `value` raqam). Admin paneldan o'zgaradi: `GET/PUT /api/admin/settings` (**faqat admin**).
| Kalit | Ma'nosi | Chegara | Standart |
|---|---|---|---|
| `default_commission_percent` | umumiy komissiya, % | 0–100 | 10 |
| `min_payout_amount` | minimal yechish summasi, so'm | 1 000 – 100 000 000 (butun) | 100 000 |

**Ilovalar o'qiydigan ENDPOINT'lar (aniq maydonlar):**
| Kim / nima | Endpoint | Maydonlar |
|---|---|---|
| **Hamma** (loginsiz), umumiy qiymatlar — **YANGI** | `GET /api/settings/public` | `{ "min_payout": 100000, "default_commission_rate": 10 }` (`min_payout` — butun so'm; `default_commission_rate` — foiz, kasr bo'lishi mumkin). Boshqa sozlama (nishon chegaralari va h.k.) chiqmaydi |
| **Trener o'zi uchun** (Bearer/cookie) | `GET /api/trainer/earnings` | `rate` — **amaldagi** komissiya %, `custom_rate` — `true` bo'lsa shaxsiy foiz, `min_payout` — minimum (so'm), shuningdek `balance`, `lifetime{gross,commission,net,sales}`, `payouts{…}`, `monthly[12]`, `recent_sales[20]`. Trener bo'lmasa `403 {"message":"Bu bo'lim faqat trenerlar uchun"}` |
| Trener o'zi uchun | `GET /api/trainer-profile` | `commission_rate` — **shaxsiy** foiz (`null` = umumiy foiz qo'llanadi), `effective_commission` — amaldagi foiz; karta maydonlari yo'q |
| Hamma ko'radigan trener ma'lumoti | `GET /api/trainers`, `GET /api/trainers/{id}` | **Komissiya, balans, karta HECH QACHON chiqmaydi** (testlar bilan kafolatlangan). Trenerning shaxsiy komissiyasini faqat o'zi va admin ko'radi |

**`POST /api/payouts` minimumni serverda tekshiradimi? — HA.** Tekshiruv bazadagi `request_payout` funksiyasi ichida, `get_setting('min_payout_amount', 100000)` dan o'qiladi (admin o'zgartirgani darhol kuchga kiradi, kesh yo'q). Summa minimumdan kichik bo'lsa: **400 `{"message":"Minimum 100,000 so'm","code":"BELOW_MIN"}`** (raqam inglizcha vergul bilan formatlanadi — matnni emas, `code` ni tekshiring). Boshqa kodlar: `Summa noto'g'ri` (400; butun son, >0, ≤ 2 000 000 000 bo'lmasa), `PAYOUT_PENDING` (409), `INSUFFICIENT_FUNDS` (400), `NO_SAVED_CARD`, `BAD_CARD`, `BAD_HOLDER` (400).
**Eslatma:** `GET /api/settings/public` CDN'da keshlanadi (tokensiz so'ralsa): admin sozlamani o'zgartirsa ilovada ~30 s (eng ko'pi ~5.5 daqiqa) eski qiymat ko'rinishi mumkin. Haqiqiy tekshiruv doim serverda — ekrandagi raqam faqat ko'rsatish uchun.

---
## 2) `GET /api/posts`: `likes_count`, `views_count`, `is_liked` — qanday hisoblanadi

| Maydon | Manba |
|---|---|
| `likes_count` | `posts.likes_count` ustuni. DB trigger (`post_likes` ga INSERT → +1, DELETE → −1) yangilaydi |
| `comments_count` | `posts.comments_count`, izoh trigger'i yangilaydi |
| `views_count` | `posts.views_count`; **faqat** `POST /api/posts/{id}/view` oshiradi (har chaqiruv +1) |
| `is_liked` | **faqat tizimga kirgan** (cookie yoki Bearer) foydalanuvchiga: `post_likes` dan shu foydalanuvchi uchun. **Mehmonda maydon umuman yo'q** (`false` emas) |

Sanoqlar **hamma ko'ruvchiga bir xil** (token bor-yo'qligi ta'sir qilmaydi; testlar bilan tasdiqlangan), `GET /api/posts` kesh qilinmaydi.

**Android 0, web/iOS 3 — server tomondan sabab ko'rinmaydi**, chunki veb ham xuddi shu `GET /api/posts` javobidagi `post.likes_count` / `post.views_count` ni o'qiydi. Eng ehtimolli sabablar (Android chat tekshirsin; men Android kodini ko'rmayman):
1. **Kalit nomi/xaritalash:** maydonlar snake_case va **post obyektining o'zida** (ichma-ich emas): `likes_count`, `comments_count`, `views_count`.
2. **Sanoq boshqa javobdan o'qilmoqda.** Bu javoblarda sanoq **yo'q edi**: `POST /posts/{id}/like` faqat `{liked}` qaytarardi; `POST /posts/{id}/view` faqat `{success}`; `GET /api/athletes/{id}` postlarida `views_count` tanlanmagan edi (v44 da tuzatildi, quyida).
3. **Lokal kesh / optimistik holat:** ilova postni birinchi marta 0 bilan saqlab, keyin yangilamayotgan bo'lishi mumkin (masalan "bor bo'lsa almashtirma" qoidasi).
4. **NULL:** ustunlar `INTEGER DEFAULT 0` (NOT NULL emas). Trigger `likes_count + 1` ishlatadi, **NULL bo'lsa u abadiy NULL qoladi**. Qat'iy tipli parser NULL ni 0 ga aylantiradi yoki xato beradi (v44 da server NULL ni 0 qilib beradi, quyida).
5. Ro'yxat `?limit=` bilan so'ralsa javob `{items,next_cursor}`, bo'lmasa oddiy massiv — parser noto'g'ri tarmoqni o'qiyotgan bo'lishi mumkin.

**Aniq tekshiruv (1 daqiqa):**
```
curl -s "https://www.trainertop.uz/api/posts" | python3 -c "import sys,json; [print(p['id'][:8], p.get('likes_count'), p.get('views_count')) for p in json.load(sys.stdin)[:5]]"
```
Bu yerda 3 chiqsa (token'siz ham), server to'g'ri — muammo Android'ning o'qishi/keshida. Android'dan: shu so'rovning **xom JSON javobini** log qilib yuborsin.

**v44 da qilingan (server tomoni, qo'shimcha):** (a) `likes_count/comments_count/views_count` **hech qachon NULL emas** (`GET /api/posts`, `GET /api/trainers/{id}` postlari, `GET /api/athletes/{id}` postlari); (b) `GET /api/athletes/{id}` postlariga `views_count` qo'shildi; (c) `POST /api/posts/{id}/like` endi `{ "liked": true|false, "likes_count": <yangi son> }` qaytaradi (eski mijozlar `liked` ni o'qiyveradi).
**Topilgan, TUZATILMAGAN:** `POST /api/posts/{id}/view` atomik emas (o'qib-yozish: parallel ko'rishlarda sanoq yo'qoladi) va har chaqiruv +1 (bir foydalanuvchi ko'p marta oshira oladi); trigger `likes_count − 1` manfiy songa tushishi mumkin; NULL sanoq trigger bilan tiklanmaydi. Kerak bo'lsa: backfill + `NOT NULL DEFAULT 0` + `greatest(0, …)` + atomik `views` RPC — alohida migratsiya.

---
## 3) Video savol/javobini darslik guruhiga aks ettirish — **QILINDI (v44)**
**Yangi route yo'q.** Mavjud route'lar ishlaydi, server o'zi guruhga yozadi:
- Savol: `POST /api/lessons/{lessonId}/questions` `{ "question", "video_title" }` — **`video_title` bo'sh bo'lmasa** savol guruhga tushadi.
- Javob: `PATCH /api/lessons/{lessonId}/questions/{questionId}` `{ "answer" }` — **birinchi javob** guruhga tushadi (keyingi tahrirlar tushmaydi).
- **O'qish:** darslik guruhini `GET /api/chat/groups` ro'yxatidan toping (`lesson_id == lessonId` bo'lgan element, `id` — guruh id'si); xabarlar — mavjud `GET /api/chat/groups/{groupId}/messages` (yangi maydonlar avtomatik keladi; Realtime INSERT'larida ham).

**Xabar formati** (`type` — doim `"text"`, yangi tur yo'q):
```json
// savol — yuboruvchi: savol bergan foydalanuvchi
{ "id": "…", "group_id": "…", "sender_id": "<asker>", "type": "text",
  "content": "📹 Lesson 1\nNafas qanday olinadi?",
  "video_title": "Lesson 1", "lesson_question_id": "<uuid>", "lesson_question_kind": "question",
  "created_at": "…", "sender": { "id": "…", "full_name": "…", "avatar_url": "…" } }
// javob — yuboruvchi: darslik treneri
{ …, "sender_id": "<trainer>", "type": "text",
  "content": "📹 Lesson 1\n↩️ Javob: Ko'tarishda chiqarib oling",
  "video_title": "Lesson 1", "lesson_question_id": "<uuid>", "lesson_question_kind": "answer" }
```
- Uch yangi maydon **ixtiyoriy** (boshqa xabarlarda `null`): `video_title`, `lesson_question_id`, `lesson_question_kind` (`"question"` | `"answer"`). Eski mijozlar (website/Android) `content` dagi "📹 …" birinchi qatori tufayli kontekstni oddiy matnda ko'radi.
- **iOS uchun:** `lesson_question_kind != null` bo'lsa — belgi "📹 {video_title}", `content` ning **birinchi qatorini** (`📹 …\n`) qirqing; `answer` uchun yana `↩️ Javob: ` prefiksini qirqib "Javob" yorlig'i ko'rsating. `lesson_question_id` — Savol-javob bo'limidagi shu savolga o'tish uchun.
- **Qachon tushmaydi (savol baribir saqlanadi):** umumiy savol (`video_title` yo'q); darslikning guruhi yo'q; yuboruvchi guruhning faol a'zosi/egasi emas (muddati tugagan oylik a'zo, chiqarilgan); yozishi cheklangan (mute); **javob** — agar savolning guruhdagi xabari yo'q bo'lsa (yolg'iz javob yozilmaydi; v44 dan oldingi savollarga javoblar ham guruhga tushmaydi); takroriy aks ettirish (bitta savol uchun bitta savol va bitta javob xabari — baza darajasida kafolatlangan).
- **Push:** guruh bildirishnomasi yuborilmaydi (trenerga "Darsligingizga yangi savol", savol egasiga "Savolingizga javob berildi" allaqachon bor). Guruh a'zolarida xabar odatdagidek o'qilmagan sanog'ini oshiradi.
- **Xavfsizlik:** uchala maydonni faqat server yozadi — oddiy foydalanuvchi to'g'ridan-to'g'ri yozsa/o'zgartirsa baza trigger'i ularni NULL qiladi (soxta "javob" haqiqiy aks ettirishni bloklay olmasligi uchun).
- **Deploy:** **avval** `migration-v32-question-group-mirror.sql`, keyin kod. Kod SQL'dan oldin chiqsa savollar ishlayveradi, faqat guruhga aks ettirish jimgina o'tkazib yuboriladi (log'ga yoziladi). (Shuningdek v31 SQL ham hali ishga tushirilmagan bo'lsa — u birinchi.)

---
## Sinov natijalari
JS: 3 ta yangi test fayli, 53 test — sozlamalar/post sanoqlari/like **19**, aks ettirish kutubxonasi **19**, savol/javob route'lari **15** (oldingi xatti-harakatlar — 401/404/400/403, push — ham qayta tekshirilgan). **74 ta mutantning hammasi tutildi.** Dastlab 3 tasi omon qolgan edi (like'dagi sanoq so'rovining ustun/post id'i va yozilmagan xabar uchun "o'qildi" belgilanmasligi) — shu uchun testlar qo'shildi.
SQL (real Postgres 16, v3→v31 zanjiri + v32): asosiy holat to'g'ri; **11/11 mutant tutildi** — UNIQUE, CHECK'lar, FK `SET NULL`/cascade, soxtalashtirishdan himoya triggeri (INSERT va UPDATE), qayta ishga tushirish xavfsizligi. Eslatma: haqiqiy bazada `messages` da INSERT/UPDATE siyosati yo'q (oddiy foydalanuvchi baribir yoza olmaydi), trigger qo'shimcha himoya qatlami sifatida vaqtinchalik siyosatlar bilan alohida sinaldi.
**TekshirilMAGAN:** jonli qurilmada/production'da (Android'ning 0 sababi — uning kodini ko'rmadim); guruh chatida "📹" qatori ilovada/brauzerda qanday chizilishi; yuklama ostida aks ettirishning poygasi (baza darajasida UNIQUE bilan kafolatlangan, lekin sinalmagan).
