# Umumiy shikoyat (report) va foydalanuvchini bloklash (v24)

Play Market UGC (foydalanuvchi kontenti) siyosati talabi bo'yicha qo'shildi. Hozirgacha faqat CHAT xabariga shikoyat bor edi — endi post, izoh, sharh va foydalanuvchining o'ziga ham shikoyat qilish va bloklash mumkin.

## Nima qo'shildi

### 1. Umumiy shikoyat — `POST /api/reports`
- `{target_type: "post"|"comment"|"user"|"lesson", target_id, reason, note?}`
- `reason` — mavjud `MOD_REASONS` bilan bir xil (adult/abuse/spam/offtopic/other), "other" tanlansa izoh majburiy
- O'zingizga (o'z postingiz/o'zingiz) shikoyat qilib bo'lmaydi
- Kuniga ko'pi bilan 20 ta shikoyat (429 xato)
- Bir xil narsaga ikkinchi marta shikoyat qilinsa — 409 ("allaqachon shikoyat qilgansiz")
- Shikoyat qilingan payt kontentning **suratlanmasi (snapshot)** saqlanadi — keyin kontent o'chirilsa/o'zgarsa ham admin nima haqida shikoyat qilinganini ko'radi

### 2. Bloklash — `POST/DELETE /api/blocks`, `GET /api/blocks`
- **Bir tomonlama**: bloklangan odamning posti/izohi/sharhi **faqat bloklagan foydalanuvchining o'z lentasida** ko'rinmay qoladi. Bloklangan odamning o'ziga yoki boshqalarga hech narsa o'zgarmaydi.
- O'zini o'zi bloklab bo'lmaydi. Ikkinchi marta bloklash xato bermaydi (idempotent).
- Filtrlangan joylar: postlar lentasi, post izohlari, trener profilidagi sharhlar, darslik sharhlari, rasmiy kanal izohlari.

### 3. Admin panel — `/admin/reports`
Yangi "Shikoyatlar" sahifasi: post/izoh/darslik/foydalanuvchiga qilingan barcha shikoyatlar, ko'rilgan/ko'rilmagan filtri bilan. **Diqqat**: chat xabar shikoyatlari bu yerda emas — ular **Admin › Guruhlar** sahifasidagi "Shikoyatlar" tabida, avvalgidek (alohida oqim, o'zgarmagan).

### 4. Frontend
- **Postlar sahifasi**: boshqa odamning postida "..." menyu — "Shikoyat qilish" va "[Ism] ni bloklash". Izohlarda ham (hover'da) shikoyat tugmasi.
- **Trener/atlet profil sahifasi**: xuddi shunday "..." menyu — foydalanuvchining o'ziga shikoyat yoki uni bloklash. Bloklangach bosh sahifaga qaytariladi.

## Deploy tartibi
1. `supabase/migration-v24-reports-blocks.sql` ishga tushiring (mustaqil — boshqa migratsiyalarga bog'liq emas).
2. Kodni push qiling.

## API
| Yo'l | Vazifasi |
|---|---|
| `POST /api/reports` | Umumiy shikoyat (post/izoh/foydalanuvchi/darslik) |
| `POST /api/blocks` | Bloklash — `{user_id}` |
| `DELETE /api/blocks/[userId]` | Blokdan chiqarish |
| `GET /api/blocks` | O'zi bloklaganlar ro'yxati |
| `GET/PATCH /api/admin/content-reports` | Admin: shikoyatlar ro'yxati/ko'rilgan deb belgilash |

## Sinov natijalari
- Real-Postgres: **13/13** (`t_v24.py`), mutatsiya 7 tadan **5 tasi tutildi** (2 tasi asosli equivalent — RLS+REVOKE qo'sh himoya). 11 ta migratsiya birga tekshirildi.
- TS/JS: **1038/1038** (37 fayl), `tsc --noEmit` toza. Yangi kod uchun mutatsiya: backend 20/20, filtrlash 4/4, admin panel 8/8, postlar UI 7/7, profil menyu 5/5 — jami **44/44**.
- Production build muvaffaqiyatli.

## Ilova (Android) uchun
Yuqoridagi barcha API'lar `Bearer` token bilan ham ishlaydi (`getApiUser` orqali). Ilovada ham xuddi shunday "..." menyu (post/izoh/profil) qo'shish kifoya.
