# Chat yangilanishi (v13): ovoz, rasm, video va darslik guruhlari

## Nima qo'shildi

1. **1:1 chatda** matn, rasm, ovozli xabar va video.
2. **Darslik guruhlari** — har bir e'lon qilingan darslik uchun yopiq guruh **avtomatik** yaratiladi, darslikni sotib olgan har bir kishi **avtomatik** qo'shiladi. Xaridor bo'lmagan odam guruhni ko'rmaydi ham, topa ham olmaydi.
3. **Qulflangan guruh** — oylik obuna tugasa guruh chatlar ro'yxatida **qoladi**, lekin ichiga kirib bo'lmaydi. U yerda "Oylik to'lovni to'lash" tugmasi (Click) va "Guruhdan chiqib ketish" bor. To'lov qilinsa guruh o'zi ochiladi.
4. **Guruh admini = trener**: nom, tavsif va rasmni o'zgartiradi, a'zolarning xabarini o'chiradi, a'zoni chiqaradi/qaytaradi.
5. Guruhga **birinchi kirganda** bir martalik tanishtiruv chiqadi (keyin "Guruh haqida"da turadi).
6. Xabarni **hamma uchun o'chirish** (matn va fayl tozalanadi, fayl R2'dan ham o'chadi).
7. Xabarlar **sahifalab** yuklanadi (50 tadan), realtime uzilsa **qayta ulanganda** yo'qolgan xabarlar to'ldiriladi.

## Deploy tartibi (MUHIM)

1. Supabase → SQL Editor → `supabase/migration-v13-chat-groups.sql` ni ishga tushiring (qayta ishga tushirsa ham xavfsiz). Oxirida "TEKSHIRUV" jadvali chiqadi: `OK` va "0 bo'lishi kerak" qatorlari 0 bo'lishi shart.
2. **Shundan keyin** kodni push qiling (Vercel deploy).
3. Yangi env o'zgaruvchisi **kerak emas**. R2 CORS o'zgarmaydi (`r2-cors.json` allaqachon GET/PUT/HEAD + ETag beradi).

Tartib buzilsa (kod SQL'dan oldin chiqsa) chat sahifasi guruhlarni yuklay olmaydi va o'qilmagan xabarlar soni 0 ko'rinadi.

## Ma'lumotlar bazasi

| Jadval / funksiya | Vazifasi |
|---|---|
| `chat_groups` | Guruh: `lesson_id` (unique), `owner_id`, `name`, `bio`, `avatar_url`, `is_archived`, oxirgi xabar |
| `chat_group_members` | A'zo: `role` (owner/member), `status` (active/removed/left), `last_read_at`, `seen_intro_at` |
| `messages` (kengaytirildi) | `group_id` YOKI `conversation_id` (faqat bittasi), `type` (text/image/voice/video), `media_url`, `media_duration`, `thumb_url`, `deleted_at` |
| `group_access(group, user)` | `owner` / `active` / `expired` / `none` — **yagona haqiqat manbai** (faqat service_role) |
| `group_access_me(group)` | RLS uchun, faqat joriy foydalanuvchi haqida |
| `chat_group_list(user)`, `chat_unread_total(user)` | Ro'yxat va o'qilmagan sonlari (faqat service_role) |

**Kirish qoidasi** (`group_access`):
- `owner` — darslik egasi.
- `active` — a'zo va xarid to'langan (umrbod yoki oylik muddati tugamagan).
- `expired` — a'zo, lekin oylik muddat tugagan: guruh ro'yxatda ko'rinadi, xabarlari o'qilmaydi (RLS ham bermaydi).
- `none` — a'zo emas, trener chiqargan, ban, darslik o'chirilgan (admin), guruh arxivlangan, xarid qaytarilgan.

**Triggerlar**: darslik `published` bo'lganda guruh yaratiladi; xarid `paid` bo'lganda a'zo qo'shiladi.
- Trener **chiqargan** (`removed`) a'zo qayta to'lasa ham **qaytmaydi**.
- O'zi **chiqib ketgan** (`left`) a'zo yangi to'lovda **avtomatik qaytadi**.

**Yozish faqat server orqali**: brauzer (anon/authenticated) guruh, a'zo yoki guruh xabarini yoza/o'zgartira olmaydi — hammasi API'da (service_role) tekshiriladi.

## API (app chati uchun shartnoma)

Hammasi cookie yoki `Authorization: Bearer` bilan ishlaydi.

| Endpoint | Izoh |
|---|---|
| `GET /api/chat` | 1:1 suhbatlar (o'zgarmagan) |
| `GET /api/chat/groups` | Mening guruhlarim: `access`, `unread`, `last_message`, `price_monthly`, `lesson_id` |
| `GET /api/chat/groups/[id]` | Guruh tafsiloti (a'zo bo'lmaganga 404). `expired` bo'lsa ham qaytadi (qulf ekrani uchun) |
| `PATCH /api/chat/groups/[id]` | Faqat admin: `name`, `bio`, `avatar_url` |
| `GET/POST /api/chat/groups/[id]/messages` | `?before=<ISO>&limit=50`. `expired` → 403 `{code:"EXPIRED"}` |
| `GET /api/chat/groups/[id]/members` | Admin hammani, a'zo faqat faollarni ko'radi |
| `PATCH /api/chat/groups/[id]/members/[userId]` | Admin: `{status:"removed"\|"active"}` |
| `POST /api/chat/groups/[id]/intro-seen` | Tanishtiruv ko'rildi |
| `POST /api/chat/groups/[id]/leave` | Faqat `expired` holatda |
| `GET/POST /api/chat/[id]/messages` | 1:1 (endi faqat ishtirokchi; sahifalash bilan) |
| `DELETE /api/chat/messages/[id]` | Hamma uchun o'chirish (egasi; guruhda admin ham) |
| `GET /api/chat/unread` | 1:1 + guruhlar yig'indisi |
| `PATCH /api/admin/groups/[id]` | Admin: `{archived:boolean}` |

**Xabar yuborish** (`POST .../messages`): `{type:"text", content}` yoki
`{type:"image"|"voice"|"video", media_url, media_duration?, media_size?, media_mime?, thumb_url?, content?(izoh)}`.
`media_url` faqat **o'zining** `chat/<userId>/...` papkasidagi yuklangan fayl bo'lishi shart.

**Fayl yuklash**: rasm va ovoz → `POST /api/upload` (`bucket=chat`, 4 MB gacha); video → `/api/upload/init` → bo'laklar R2'ga to'g'ridan-to'g'ri → `/api/upload/complete` (`folder=chat`).

**App uchun eslatma**: xabarni Supabase'ga to'g'ridan-to'g'ri yozmang — faqat API orqali. Guruh xabarlarini realtime'da `messages` jadvalidan `group_id=eq.<id>` filtri bilan tinglang (RLS faqat kirishi borga beradi), ulanganda oxirgi sahifani qayta oling.

## Cheklovlar

| | |
|---|---|
| Matn | 4000 belgi (izoh 1000) |
| Ovoz | 5 daqiqa, 32 kbps, ≤ 4 MB; Safari uchun MP4/AAC, Chrome/Android uchun WebM/Opus |
| Video | 2 daqiqa, 100 MB gacha |
| Guruh nomi / tavsifi | 80 / 500 belgi |

## Xavfsizlik bo'yicha o'zgarishlar

- **Tuzatildi**: `/api/chat/[id]/messages` avval suhbat ishtirokchisi ekanligini tekshirmasdi (UUID'ni bilgan istalgan login qilgan kishi o'qiy/yoza olardi).
- **Tuzatildi**: chat fayllarining nomi endi tasodifiy UUID (avval `Date.now()` — taxmin qilish mumkin edi).
- **Tuzatildi**: muddati tugagan oylik obunani qayta to'lash `create-order`da bloklangan edi ("allaqachon sotib olgansiz"). Endi tugagan oylik obuna faqat **oylik** to'lov bilan yangilanadi.
- **Cheklov**: R2 ochiq bucket — chat fayllari "taxmin qilib bo'lmaydigan havola" bilan himoyalangan, lekin havolani bilgan odam ko'ra oladi. Tana rasmlari kabi shaxsiy fayllar uchun keyinroq imzolangan (signed) URL'ga o'tish tavsiya etiladi.

## Qo'lda tekshirish ro'yxati (haqiqiy qurilmalarda)

Avtomatik testlar mikrofon va brauzer pleyerini **soxta** obyekt bilan sinaydi, shuning uchun quyidagilarni deploydan keyin o'zingiz tekshiring:

1. **Chrome (kompyuter)**: ovoz yozing → yuboring → o'ynating, tezlikni (1×/1.5×/2×) o'zgartiring.
2. **iPhone Safari**: ovoz yozing → yuboring → **boshqa qurilmada** o'ynating (MP4/AAC). Mikrofon ruxsati so'raladi.
3. **Android Chrome**: ovoz yozing va o'ynating.
4. Rasm va 30–60 soniyalik video yuboring (videoda progress va muqova chiqishi kerak).
5. Trener hisobida darslik e'lon qiling → guruh paydo bo'lishi; boshqa hisobdan sotib oling → guruh avtomatik chiqishi.
6. Sotib olgan hisobning `purchases.expires_at`ni o'tmishga qo'ying (`purchase_type='monthly'`) → guruh **qulflangan** ko'rinadi, to'lov tugmasi Click oynasini ochadi, to'lovdan keyin guruh ochiladi.
7. Trener hisobida: guruh nomini o'zgartiring, a'zoning xabarini o'chiring, a'zoni chiqaring va qaytaring.
8. Ikki oynada bir guruhni oching: xabar ikkinchisida darhol paydo bo'lishi kerak; internetni bir necha soniya o'chirib yoqing — uzilish paytidagi xabarlar to'lishi kerak.
9. Telefonda pastki menyu yozish panelini yopib qo'ymayotganini tekshiring.

## Ataylab qilinmagan (keyingi bosqich)

- Guruhga yangi xabar uchun bildirishnoma (hozir faqat o'qilmagan xabarlar nishoni).
- Xabarga shikoyat qilish (report) va admin uchun guruh xabarlarini ko'rish.
- Signed URL (shaxsiy fayllar), xabarga javob berish, reaksiyalar, "yozmoqda..." belgisi.
- Guruh a'zolarini trenerdan boshqa yo'l bilan taklif qilish (kerak emas — faqat xaridorlar).


> **Yangilanish (v15):** a'zoga chora (cheklash/chiqarish sabab bilan), shikoyatlar, admin guruhlar paneli va Telegram murojaatlari — `docs/group-moderation.md` ga qarang. Eslatma: `group_access()` da yangi `removed` holati bor (yuqoridagi jadvaldagi `none` — endi faqat o'zi chiqib ketgan/begona/ban holatlari).

> **Yangilanish (v16):** chat ro'yxatida rasmiy "TrainerTop" kanali (admin e'lonlari) — `docs/announcements.md` ga qarang.
