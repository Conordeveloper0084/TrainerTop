# iOS: pul yechish tarixi va "Obunachilarim" (v45)

Ikkala endpoint ham **loginli** (Bearer token yoki cookie). Javoblar shaxsiy — `Cache-Control: private, no-store`.

---
## 1) Trenerning pul yechish tarixi — `GET /api/payouts`
Yangi endpoint kerak emas — mavjud endpoint tuzatildi va sahifalash qo'shildi.

**So'rov**
```
GET /api/payouts?limit=20                                  // birinchi sahifa
GET /api/payouts?limit=20&cursor=<oldingi javobdagi next_cursor>
Authorization: Bearer <token>
```
- `limit` 1–50 (standart 20). Yangilari birinchi (`requested_at` kamayish tartibida).
- Parametrsiz chaqirilsa — massiv (eng ko'pi 100 ta); sayt shunday ishlaydi. iOS `limit` bilan chaqirsin.
- **Kursorni URL'ga kodlab yuboring:** `2026-10-20T08:00:00+00:00` dagi `+` ni **`%2B`** qiling (iOS `URLQueryItem` `+` ni o'zi kodlamaydi). Server kodlanmagan `+` ni ham tiklaydi (v45), lekin to'g'ri kodlash ishonchliroq.

**Javob (200)** — `{ items, next_cursor }`; `next_cursor: null` — oxirgi sahifa.
```json
{
  "items": [
    {
      "id": "7c1e3b52-0f3a-4c1d-9a55-2d9b8f0c1a11",
      "trainer_id": "11111111-1111-4111-8111-111111111111",
      "amount": 150000,
      "status": "pending",
      "requested_at": "2026-11-04T10:15:30.123456+00:00",
      "completed_at": null,
      "admin_note": null,
      "reject_reason": null,
      "card_holder": "ALI VALIYEV",
      "card_last4": "1234",
      "card_masked": "•••• 1234",
      "card_number": "•••• 1234"
    },
    {
      "id": "…", "amount": 300000, "status": "completed",
      "requested_at": "2026-10-28T09:00:00+00:00", "completed_at": "2026-10-29T12:30:00+00:00",
      "admin_note": "Chek: 48213", "reject_reason": null,
      "card_holder": "ALI VALIYEV", "card_last4": "1234", "card_masked": "•••• 1234", "card_number": "•••• 1234"
    },
    {
      "id": "…", "amount": 120000, "status": "rejected",
      "requested_at": "2026-10-20T08:00:00+00:00", "completed_at": "2026-10-20T15:10:00+00:00",
      "admin_note": "Karta egasi ismi mos kelmadi", "reject_reason": "Karta egasi ismi mos kelmadi",
      "card_holder": "ALI VALIYEV", "card_last4": "9012", "card_masked": "•••• 9012", "card_number": "•••• 9012"
    }
  ],
  "next_cursor": "2026-10-20T08:00:00+00:00"
}
```

**Maydonlar**
| Maydon | Turi | Izoh |
|---|---|---|
| `id` | uuid | so'rov id'si |
| `amount` | butun son | so'm |
| `status` | `"pending"` \| `"completed"` \| `"rejected"` | **"paid" EMAS.** Matn: Kutilmoqda / O'tkazildi / Rad etildi (saytdagidek) |
| `requested_at` | ISO 8601 | yuborilgan sana (mikrosekund bo'lishi mumkin; `+00:00` zonasi) |
| `completed_at` | ISO 8601 \| null | hal qilingan sana — o'tkazilgan **ham**, rad etilgan **ham**; `pending` da `null` |
| `reject_reason` | matn \| null | faqat `rejected` da — admin yozgan sabab (bo'sh bo'lishi mumkin: saytda "Sabab ko'rsatilmagan") |
| `admin_note` | matn \| null | admin izohi: `rejected` da sabab bilan bir xil, `completed` da (masalan chek raqami) |
| `card_last4` | `"1234"` \| null | karta oxirgi 4 raqami |
| `card_masked` | `"•••• 1234"` \| null | **ko'rsatish uchun shuni ishlating** |
| `card_number` | matn \| null | ESKI nom (sayt/Android o'qiydi) — endi **har doim maskalangan**, `card_masked` bilan bir xil |
| `card_holder` | matn \| null | kartadagi ism, KATTA lotin harflarida |
| `trainer_id` | uuid | o'zingizning id'ingiz |

**Karta:** to'liq raqam ham, shifrlangan qiymat ham javobda **hech qachon** yo'q (karta har bir so'rovda qayta kiritiladi). Eski (v26 dan oldingi) yozuvlarda ham faqat oxirgi 4 raqam qaytadi. Karta ma'lum bo'lmasa `card_*` maydonlari `null`.

**Xatolar:** `401 {"message":"Login kerak"}`; `400 {"message":"cursor noto'g'ri"}` (kursor sana emas); `500 {"message":"Server xatolik"}`.

**Bilib qo'ying**
- Bir vaqtda faqat **bitta** `pending` so'rov bo'lishi mumkin (yangisi `409 PAYOUT_PENDING`); so'rov summasi balansdan darhol ushlab turiladi, rad etilsa qaytariladi.
- Yangi so'rov: `POST /api/payouts` (mavjud). Minimum va komissiya: `GET /api/settings/public`, `GET /api/trainer/earnings` (`balance`, `min_payout`, `rate`) — `docs/app-answers-v44.md`.
- **Nima o'zgardi (v45):** oldin javobda `card_number_encrypted` (shifrlangan karta) va hal qilgan adminning id'si (`completed_by`) ham bor edi, eski yozuvlarda esa to'liq karta raqami — endi hammasi yashirilgan. **Saytdagi xato ham tuzaldi:** yangi so'rovlarda karta ustuni bo'sh chiqardi (`card_number` v26 dan beri `null`), endi `•••• 1234` ko'rinadi.

---
## 2) "Obunachilarim" — `GET /api/followers`
Endpoint **allaqachon mavjud** (sayt ishlatadi); iOS so'ragan `username` v45 da qo'shildi, `has_more` va `page` ham.

**So'rov**
```
GET /api/followers?page=0           // 0 dan boshlanadi, har sahifada 30 ta
GET /api/followers?page=1&q=ali     // q — ism bo'yicha qidiruv (ixtiyoriy)
Authorization: Bearer <token>
```
Faqat **o'zingizning** obunachilaringiz (trener ham, oddiy foydalanuvchi/atlet ham o'zinikini ko'radi). Yangi obunachilar birinchi. Email/telefon hech qachon chiqmaydi.

**Javob (200)**
```json
{
  "total": 42,
  "page_size": 30,
  "page": 0,
  "has_more": true,
  "rows": [
    {
      "id": "5d2f0c1e-1111-4222-8333-444455556666",
      "full_name": "Ali Valiyev",
      "avatar_url": "https://pub-….r2.dev/avatars/5d2f…/img-1.jpg",
      "username": "ali_v",
      "role": "user",
      "followed_at": "2026-11-04T10:15:30.123456+00:00",
      "is_student": true,
      "badge": null
    },
    { "id": "…", "full_name": "Zarina Yoga", "avatar_url": null, "username": null, "role": "trainer",
      "followed_at": "2026-11-01T08:00:00+00:00", "is_student": false, "badge": "trainer" }
  ]
}
```
| Maydon | Izoh |
|---|---|
| `id`, `full_name`, `avatar_url` | obunachi profili (`avatar_url` bo'lmasligi mumkin — `null`) |
| `username` | `@username` uchun; **`null` bo'lishi mumkin** (hamma foydalanuvchida emas) |
| `role` | `"user"` \| `"trainer"` |
| `followed_at` | obuna sanasi (ISO 8601) |
| `is_student` | shu trenerning pullik darsligini sotib olganmi ("shogird" belgisi); trener bo'lmagan akkauntda doim `false` |
| `badge` | `"trainer"` (tasdiqlangan trener) \| `"athlete"` (atlet nishoni) \| `null` |

**Sahifalash (bu endpoint KURSOR emas, `page` bilan):** keyingi sahifa bormi-yo'qligini **`has_more`** dan biling. `total` ban qilingan foydalanuvchilarni ham sanaydi va ular ro'yxatdan chiqarib tashlanadi, shuning uchun sahifada 30 tadan kam qator kelishi mumkin — "kam keldi, demak oxirgi" deb o'ylamang. Noto'g'ri/manfiy `page` — 0 deb olinadi.
**Xatolar:** `401 {"message":"Login kerak"}`, `500 {"message":"Server xatolik"}`.

---
## Sinov natijalari
JS: `payouts-followers` — 26 test (karta hech qachon sizib chiqmasligi, holatlar, sahifalash, kursor, obunachilar, `has_more`). 44 mutantdan 43 tasi tutildi, 1 tasi ekvivalent (bo'sh satr kursori ikkala holatda ham `null`). SQL o'zgarishi yo'q. `tsc` va production build o'tdi.
**Qo'shimcha topilma va tuzatish:** vaqt belgisi kursorlaridagi `+00:00` ning `+` belgisi URL'da bo'shliq deb o'qilar edi (`URLSearchParams`; iOS `URLQueryItem` `+` ni kodlamaydi) — kursor yaroqsiz bo'lib qolardi. Umumiy `parsePageParams` da tuzatildi, shuning uchun `GET /api/posts`, `/api/lessons`, `/api/trainers` ning `cursor` parametrlariga ham tegishli (ular bu yordamchidan foydalanadi).
**TekshirilMAGAN:** jonli qurilmada/production'da; iOS tomonda kursorni kodlash usuli.
