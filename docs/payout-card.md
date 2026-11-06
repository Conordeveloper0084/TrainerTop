# Trener pul yechish kartasini (ixtiyoriy) shifrlab saqlash

Trener xohlasa, pul yechish kartasini keyingi safar qayta kiritmaslik uchun saqlashi mumkin. Karta raqami **ILOVA DARAJASIDA** (Node.js `crypto`, AES-256-GCM) shifrlanadi — bazaga xom (ochiq) raqam hech qachon yozilmaydi.

## Deploy tartibi
1. **SQL**: `supabase/migration-v26-payout-card.sql` (v12'ga bog'liq; mustaqil, qayta ishga tushirsa xavfsiz).
2. **Yangi env o'zgaruvchisi**: `PAYOUT_CARD_KEY` — **64 ta hex belgi** (32 baytlik AES-256 kalit). Masalan generatsiya qilish uchun: `openssl rand -hex 32`. Vercel'ga qo'shing, **repoda saqlamang**. Bu o'zgaruvchi bo'lmasa yoki noto'g'ri bo'lsa: saqlangan karta bilan ishlash (yangi karta kiritib shifrlash) **500 xato** qaytaradi, lekin **saqlangan kartadan FOYDALANISH** (`use_saved_card`) ta'sirlanmaydi (chunki hech narsa qayta shifrlanmaydi).
3. Kod push qiling.

## Yangi endpointlar

### `GET /api/trainer/payout-card`
Saqlangan kartani ko'rish (faqat oxirgi 4 raqam + egasi — **TO'LIQ raqam hech qachon qaytmaydi**).

```
→ 200 { "last4": "9012", "holder": "ALI VALIYEV" }
→ 200 null                                            // karta saqlanmagan
→ 401 { "message": "Login kerak" }
```

### `PUT /api/trainer/payout-card`
Kartani shifrlab saqlaydi (bor bo'lsa almashtiradi — upsert). **Faqat trenerlar.**

```
← { "card_number": "8600 1234 5678 9012", "card_holder": "Ali Valiyev" }
→ 200 { "last4": "9012", "holder": "ALI VALIYEV" }
→ 400 { "message": "...", "code": "BAD_CARD" | "BAD_HOLDER" }
→ 403 { "message": "Faqat trenerlar kartani saqlashi mumkin" }
→ 500                                                  // PAYOUT_CARD_KEY sozlanmagan
```

### `DELETE /api/trainer/payout-card`
Saqlangan kartani o'chiradi. Karta bo'lmasa ham `200` (idempotent).

```
→ 200 { "success": true }
```

## `POST /api/payouts` — ikki rejim

**(a) Qo'lda kiritish** (avvalgidek, lekin endi ixtiyoriy saqlash bilan):
```
← { "amount": 150000, "card_number": "8600123456789012", "card_holder": "Ali Valiyev", "save_card": true }
```
`save_card` ixtiyoriy (standart `false`). `true` bo'lsa, SHU karta (shifrlab) ham saqlanadi — pul yechish so'rovi bunga bog'liq emas (saqlashda xato bo'lsa ham so'rov davom etadi).

**(b) Saqlangan kartadan foydalanish** — karta/egasi umuman yuborilmaydi:
```
← { "amount": 150000, "use_saved_card": true }
→ 400 { "message": "Saqlangan karta topilmadi...", "code": "NO_SAVED_CARD" }   // karta saqlanmagan bo'lsa
```

Muvaffaqiyatli javob ikkala rejimda ham bir xil: pul yechish so'rovi obyekti (avvalgidek).

## `DELETE /api/account`
O'zgarish yo'q — endpoint allaqachon mavjud edi. Endi trener bo'lsa, saqlangan pul yechish kartasi ham avtomatik o'chiriladi.

## Admin ko'rinishi (`GET /api/admin/payouts`, `PUT /api/admin/payouts/[id]`)
Javobdagi `card_number` maydoni endi holatga qarab o'zgaradi:
- **`status: "pending"`** — TO'LIQ karta raqami (deshifrlab) ko'rsatiladi — o'tkazishni amalga oshirish uchun.
- **`status: "completed"` yoki `"rejected"`** — MASKALANGAN: `"•••• 1234"`.

Shifrlangan xom qiymat (`card_number_encrypted`) javobga **hech qachon** chiqarilmaydi.

## Website UI
`PayoutModal.tsx`: saqlangan karta bo'lsa standart shu ko'rsatiladi ("•••• 1234 — ISMI", "Boshqa karta" va o'chirish tugmasi bilan); bo'lmasa — oddiy forma, "Bu kartani saqlash" katagi bilan.

## Sinov natijalari
SQL: 25/25 test, 14/14 mutatsiya (2 ta REVOKE equivalent — RLS/funksiya ruxsati allaqachon bloklaydi, tasdiqlangan). JS: 70+ test (kripto, API, admin ko'rinish, website UI), mutatsiya 40+ dan barchasi tutildi. `tsc` toza.
