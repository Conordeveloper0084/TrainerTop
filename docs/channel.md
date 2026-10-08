# Rasmiy kanalni professional qilish (v20 / ZIP v11)

> **Yangilandi (ZIP v15, migratsiya v23):** Post tahrirlash va o'chirish endi **chatning o'zidan** ham mumkin (avval faqat admin panel). Har bir postda **Telegram uslubidagi ko'rishlar soni** va **izohlar** (foydalanuvchilar fikr bildira oladi). Kanal profilini (nom/rasm/bio/username) endi **chatdagi "Kanal haqida" panelidan** ham tahrirlash mumkin. Xabar konteynerining kengligi matn uzunligiga mos qilib tuzatildi (avval har doim maksimal kenglikda cho'zilib ko'rinardi).

> **Yangilandi (ZIP v14, SQL o'zgarishisiz — faqat kod):** Admin panelda "Rasmiy kanal" va "E'lonlar" endi **butunlay alohida sahifalar**. Avval ikkalasi bitta sahifada aralash edi — endi:
> - **Admin › Rasmiy kanal** (`/admin/channel`) — kanal identifikatori + Telegram uslubidagi erkin post (matn/rasm/video, har doim hammaga). Siz shu yerdan boshqarasiz.
> - **Admin › E'lonlar** (`/admin/announcements`) — faqat **bitta foydalanuvchiga shaxsiy bildirishnoma** (auditoriya tanlash, video yo'q). "Hammaga" yuborish endi bu yerda yo'q — bu Rasmiy kanalning vazifasi.
> - **Chatda**: kanal nomiga/rasmiga bosilsa endi Telegram kanali kabi **bio/profil sahifasi** ochiladi (nom, @username, tavsif); umumiy joyga bosilsa — postlar oqimi, avvalgidek.
> - Bosh sahifadagi "Top trenerlar" va "Foydalanuvchilar baholari" bo'limlari **vaqtincha o'chirildi** (real ma'lumot yetarli bo'lguncha) — kod saqlanib qoldi, keyin osongina qaytariladi.
> - Backend (jadval, RPC) o'zgarmadi — faqat qaysi admin sahifa qaysi maqsad uchun ishlatilishi aniqlashtirildi.

## Yangi (v23): tahrirlash, ko'rishlar, izohlar — batafsil

### Chatdan tahrirlash/o'chirish
- Har bir kanal postiga (`data-testid="announcement-card"`) sichqoncha olib borilsa (yoki telefonda doim) **qalam** (tahrirlash) va **savat** (o'chirish) tugmalari chiqadi — **faqat admin uchun**, va **faqat haqiqiy kanal postiga** (avtomatik boost kartochkasi yoki shaxsiy bildirishnomaga emas).
- Tahrirlash bosilsa — pastdagi yozish maydoni (composer) shu postning matni/rasmi/video bilan to'ladi, tepada "Postni tahrirlash — Bekor qilish" banneri chiqadi. Saqlash **PATCH** so'rovi yuboradi (auditoriya/kim yuborgani o'zgarmaydi).
- Tahrirlangan post ostida kichik **"tahrirlangan"** yozuvi chiqadi (Telegram'dagidek).

### Ko'rishlar soni
- Har bir odam kanalni ochganda, ko'rinayotgan postlar avtomatik "ko'rilgan" deb belgilanadi (bir kishi bir postni faqat **bir marta** hisoblatadi — qayta ochsa qayta sanalmaydi).
- Ko'rishlar soni ko'z belgisi bilan har bir kanal postida ko'rinadi (shaxsiy bildirishnoma va boost kartochkasida ko'rinmaydi — ularga mos emas).

### Izohlar
- Har bir kanal postiga foydalanuvchilar izoh qoldira oladi (izoh tugmasi postning pastida, joriy izohlar soni bilan).
- Izoh bosilsa alohida panel ochiladi (post + izohlar ro'yxati + yozish maydoni).
- **O'z izohini** har kim, **istalgan izohni admin** o'chira oladi. Banlangan foydalanuvchining izohi hech kimga ko'rinmaydi.

### Kanal profilini chatdan tahrirlash
- "Kanal haqida" panelida (kanal nomiga bosilganda ochiladigan bio sahifasi) admin uchun **qalam tugmasi** bor — bosilsa nom/rasm/bio/username'ni o'sha yerning o'zida o'zgartirish mumkin (admin paneldagi bilan bir xil, faqat chatdan ham qulay bo'lsin uchun).

## Nima qo'shildi (asosiy, v20)

### 1. Kanal identifikatori (nom, rasm, bio, @username)
- **Admin › Kanal** sahifasida "Kanal identifikatori" kartochkasi: nom (1-40 belgi), rasm (bosib o'zgartiriladi), bio (≤200 belgi), **@username** (3-30 belgi, `a-z0-9_`, katta-kichik harfga sezmaydigan noyob).
- **Standart**: nom "TrainerTop", username "TrainerTop".
- Username hozircha **qidiruvga ulanmagan** — faqat bazada tayyor turadi, kanal chatda hali ham avtomatik hammaning ro'yxatida ko'rinadi (o'zgartirilmadi, siz shunday xohladingiz). Keyinchalik faollashtirish oson bo'ladi.
- Oddiy foydalanuvchi **shu username'ni o'ziga ololmaydi** — kanalning joriy nomi username tizimida avtomatik bloklanadi (kanal nomi keyin o'zgartirilsa, eskisi bo'shab qoladi, lekin "trainertop" so'zi doim taqiqlangan ro'yxatda qoladi).

### 2. Erkin post — Telegram kanali kabi
- Postda endi: **sarlavha ixtiyoriy**, **matn ixtiyoriy** (rasm yoki video bo'lsa), **rasm YOKI video** (ikkalasi birga bo'lmaydi). Kamida bittasi (matn/rasm/video) bo'lishi shart.
- Video: mavjud video infratuzilmasidan foydalanadi (Postlar bo'limidagi bilan bir xil chegaralar — hajm va davomiylik).
- Ikki joydan yozish, **bitta backend**:
  - **Admin › Kanal**: to'liq composer (sarlavha, matn, rasm/video, havola+tugma, auditoriya: hammaga yoki bitta foydalanuvchiga), namuna, tarix.
  - **Chat → TrainerTop kanali**: faqat adminlarga pastda yozish maydoni chiqadi (matn + rasm/video biriktirish). Har doim "hammaga" yuboradi.
- Oddiy foydalanuvchi hali ham faqat o'qiydi (composer ko'rinmaydi, "faqat o'qish" yozuvi turadi).

## Qoidalar (hammasi bazada)
- Rasm/video **faqat shu adminning o'zi yuklagan** (`channel/` papkasi) fayl bo'lishi mumkin — boshqa admin yoki boshqa papkadagi fayl manzili rad etiladi.
- Kanal `@username` **profil username'lari bilan ham to'qnashmaydi** — bittasi egallagan nomni ikkinchisi ololmaydi (ikkala yo'nalishda ham tekshiriladi).
- Soatiga ko'pi bilan **5 ta** "hammaga" post (eski chegara, o'zgarmagan).
- Ikki marta bosishdan himoya (`client_token`) — eski xulq saqlanib qoldi.
- Faqat **haqiqiy kanal posti** (kind='all', boost emas) tahrirlanadi/izohlanadi — shaxsiy bildirishnoma va avtomatik boost kartochkasi tegilmaydi.

## Deploy tartibi
1. Supabase → SQL Editor → **tartib bilan**:
   - `supabase/migration-v20-channel.sql` (agar hali ishga tushmagan bo'lsa)
   - `supabase/migration-v23-channel-interactions.sql` (yangi — tahrirlash/ko'rishlar/izohlar)
   - **Bog'liqlik**: v23 uchun v16, v17 VA v20 kerak — barchasi allaqachon production'da.
2. Kodni push qiling. Yangi env o'zgaruvchisi **kerak emas**.

## API
| Yo'l | Vazifasi |
|---|---|
| `GET /api/channel` | Ochiq: kanal identifikatori (5 daqiqa kesh) |
| `GET/PUT /api/admin/channel` | Admin: kanal sozlamalarini o'qish/yangilash |
| `POST /api/admin/announcements` | Endi `video_url`/`video_thumbnail_url`/`video_duration` ham qabul qiladi; `title`/`body` ixtiyoriy bo'ldi |
| `PATCH /api/admin/announcements/[id]` | **Yangi**: mavjud kanal postini tahrirlash |
| `GET /api/announcements` | Javobga `edited_at`/`views_count`/`comments_count` qo'shildi |
| `POST /api/announcements/view` | **Yangi**: `{ids}` — ko'rilgan postlarni belgilaydi, yangilangan sonlarni qaytaradi |
| `GET/POST /api/announcements/[id]/comments` | **Yangi**: izohlarni ko'rish/qo'shish |
| `DELETE /api/announcements/[id]/comments/[commentId]` | **Yangi**: o'z izohini yoki (admin) istalganini o'chirish |

## Sinov natijalari
- Real-Postgres: v20 — **39/39**, v23 — **18/18** (`t_v20.py`, `t_v23.py`). Eskilari buzilmagan: v12–v22, backfill — hammasi yashil, **10 ta migratsiya birga** production tartibida tekshirildi.
- SQL mutatsiya: v20 — 26 tadan 24 tutildi (3 tasi equivalent), v23 — 10 tadan 9 tutildi (1 tasi equivalent — Postgres NULL-massiv semantikasi).
- TS/JS: **960/960** (35 fayl), `tsc --noEmit` toza. Yangi kod uchun mutatsiya: backend 20/20, frontend 23/23 (2 tasi asosli equivalent — disabled tugma va JS massiv indekslash).
- Production build muvaffaqiyatli.

## Ilova (Android) uchun
`GET /api/channel` orqali kanal nomi/rasm/bio/username olinadi. `POST /api/admin/announcements` orqali video ham yuborish mumkin (admin ilovasi qilinsa). Ko'rishlar/izohlar uchun yangi endpointlar yuqorida.
