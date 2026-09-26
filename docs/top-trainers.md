# Bosh sahifa "Top trenerlar" — admin tanlaydi (v21 / ZIP v12)

## Nima qo'shildi

### Admin boshqaruvi
- **Admin › Trenerlar** — har bir trenerni ochganda **"Bosh sahifada ko'rsatish"** bo'limi: "Qo'shish"/"Olib tashlash" tugmasi.
- Qo'shilgan trenerga **ixtiyoriy qisqa matn** (≤120 belgi) — bosh sahifada reyting o'rniga yoki yo'nalish o'rniga ko'rinadi (masalan "Kuch mashqlari bo'yicha 8 yillik tajriba").
- **Tartib**: yuqoriga/pastga tugmalari bilan qo'shni ikkita trenerning o'rnini almashtirasiz. Yangi qo'shilgan trener ro'yxat oxiriga tushadi.

### Bosh sahifa
- **Admin hech kimni tanlamagan bo'lsa** (hozirgi holat) — **4 ta namunaviy** (mock) trener ko'rinadi: ism, yo'nalish, harf-avatar. **Bazaga yozilmaydi**, **Trenerlar** ro'yxatida chiqmaydi, **bosilsa hech qayerga olib bormaydi** (siz shunday so'ragan edingiz). Soxta reyting yoki shogird soni ko'rsatilmaydi — soxta ijtimoiy isbot bo'lib qolmasligi uchun.
- **Birinchi haqiqiy trener qo'shilgan zahoti** — mocklar avtomatik yo'qoladi, haqiqiy trener(lar) ko'rinadi (rasm, ism, tasdiqlangan bo'lsa nishon, reyting, sizning matningiz yoki yo'nalishi). Real trener kartasi bosilsa profiliga olib boradi.
- **Karusel**: cheksiz aylanadi (oxiridan keyin boshiga, boshidan oldin oxiriga) — chapga/o'ngga tugmalar (kompyuterda) va barmoq bilan surish (telefonda). Pastda nuqtalar joriy o'rinni ko'rsatadi.

## Qanday ishlaydi
- Karusel bitta "klon" nusxa bilan ishlaydi: oxiriga yetganda animatsiya bilan klonga o'tadi, so'ng **sezilmas tarzda** (animatsiyasiz) asl birinchi elementga qaytadi — shu orqali cheksiz aylanish hissi beriladi, aslida faqat N ta element bor.
- Bitta trener bo'lsa strelka/nuqtalar chiqmaydi (aylanadigan narsa yo'q).

## Xavfsizlik va ishonchlilik
- `GET /api/trainers/featured` — ochiq, lekin **banlangan yoki nashr etilmagan** (masalan admin keyinchalik bekor qilgan) trener avtomatik chiqarib tashlanadi, hatto admin ro'yxatdan olib tashlashni unutgan bo'lsa ham.
- Faqat maxfiy bo'lmagan maydonlar chiqadi (karta raqami, balans va h.k. hech qachon).
- Barcha o'zgartirish amallari **faqat admin** (bazaning o'zida ham tekshiriladi) va audit jurnaliga yoziladi.

## Deploy tartibi
1. Supabase → SQL Editor → `supabase/migration-v21-featured-trainers.sql` (qayta ishga tushirsa xavfsiz).
   - **Mustaqil migratsiya** — faqat asosiy sxema (trainer_profiles) kerak, boshqa v18–v20 bilan bog'liq emas.
2. Kodni push qiling. Yangi env o'zgaruvchisi **kerak emas**.

## API
| Yo'l | Vazifasi |
|---|---|
| `GET /api/trainers/featured` | Ochiq: admin tanlagan trenerlar, tartib bo'yicha |
| `PUT /api/admin/trainers/[id]` | + `featured: "add"\|"remove"\|"blurb"`, `featured_blurb` |
| `POST /api/admin/trainers/featured-reorder` | `{trainer_a, trainer_b}` — ikkitasining tartibini almashtiradi |

## Sinov natijalari
- Real-Postgres: **19/19** (`t_v21.py`). SQL mutatsiya: 13 ta variantning **hammasi tutildi** (birinchi urinishdayoq).
- TS/JS: **906/906** (33 fayl), `tsc --noEmit` toza. Mutatsiya: 29 ta variantdan **28 tasi tutildi**, 1 tasi equivalent (JS massiv indekslash: manfiy/chegaradan tashqari indeks `undefined` qaytaradi, Python'dagi kabi oxiridan hisoblamaydi — shu sabab chegarani tekshiruvchi shart olib tashlansa ham natija bir xil bo'lib qoladi).
- Production build muvaffaqiyatli.

## Ilova (Android) uchun
`GET /api/trainers/featured` orqali aynan shu ro'yxatni oling. Mock-fallback mantig'ini ilovada ham takrorlash kerak (bo'sh javob → 4 ta namunaviy karta, havolasiz).
