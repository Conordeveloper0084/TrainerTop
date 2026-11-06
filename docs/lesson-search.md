# `GET /api/lessons?search=<matn>` — darslik qidiruvi

Android ilovasi (Darsliklar qidiruvi) uchun.

## Kontrakt
- `search` — darslik **`title`**i bo'yicha `ilike '%matn%'` (katta-kichik harfga sezmaydi).
- Foydalanuvchi matnidagi `\`, `%` va `_` **ekranlanadi** (harfma-harf qidiriladi: `50%` faqat "50%" ni topadi, hamma narsani emas).
- Matn `trim` qilinadi va 100 belgigacha qisqartiriladi. Bo'sh/bo'shliqdan iborat `search` — hech qanday filtr qo'shilmaydi.
- Mavjud `category`, `difficulty`, `trainer_id`, `platform`, `limit`, `cursor` bilan **birga** ishlaydi (hammasi AND).
- Avvalgi filtrlar o'zgarmagan: `status='published'` (egasining o'z ro'yxatidan tashqari), `status != 'removed'`, ban qilingan trenerlar chiqmaydi.
- `search` yuborilmasa — hozirgi xatti-harakat aynan o'sha-o'sha (javob formati ham: `limit`/`cursor` bo'lsa `{items, next_cursor}`, bo'lmasa massiv).

## Misol
```
GET /api/lessons?search=yoga&category=yoga&limit=20
→ { "items": [...], "next_cursor": "2026-09-20T10:00:00Z" | null }
```

## Eslatma
PostgREST naqshdagi `*` belgisini `%` deb o'qiydi — foydalanuvchi `*` yozsa qidiruv biroz kengayadi (zararsiz, xavfsizlikka ta'siri yo'q).

## O'zgargan joylar
- `src/app/api/lessons/route.ts` — `search` filtri
- `src/lib/search.ts` — yangi `escapeLike()`

Deploy: faqat kod (SQL kerak emas).
