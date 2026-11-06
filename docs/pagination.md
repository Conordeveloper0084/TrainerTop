# Cursor pagination (`/api/posts`, `/api/trainers`, `/api/lessons`)

Ilovada cheksiz skroll (infinite scroll) qilish uchun qo'shildi — hozircha bu uchta ro'yxat bir yo'la HAMMA narsani qaytarardi.

## Ishlatilishi

`?limit=20&cursor=...` — ikkalasi ham **ixtiyoriy**, lekin BIRI berilsa (limit yoki cursor) javob formati o'zgaradi:

```
GET /api/posts?limit=20
→ { "items": [...], "next_cursor": "2026-09-20T10:00:00Z" | null }

GET /api/posts?limit=20&cursor=2026-09-20T10:00:00Z
→ keyingi 20 ta post
```

**Muhim**: `limit`/`cursor` umuman berilmasa — **eski xatti-harakat aynan saqlanadi** (butun massiv, website hech narsa o'zgarishini sezmaydi). `limit` eng ko'pi 50 bilan cheklanadi, noto'g'ri/manfiy qiymat standart 20ga tushadi.

## Har bir endpoint qanday sahifalaydi

- **`/api/posts`, `/api/lessons`** — `created_at` bo'yicha, bazaning o'zida (`WHERE created_at < cursor`). Samarali, katta hajmda ham tez.
- **`/api/trainers`** — bu yerda qidiruv (`search`) natija ustida **xotirada** filtrlanadi (username/ism/bio bo'yicha), shuning uchun sahifalash ham filtrlangan massiv ustida bajariladi. Cursor sifatida trenerning **noyob id**si ishlatiladi, `rating` emas — chunki ko'p trenerning reytingi bir xil (masalan yangi trenerlarda 0.0), reyting bo'yicha cursor qilinganda ular sahifalar orasida takrorlanib yoki tushib qolishi mumkin edi.

## Ilova (Android) uchun
Javobni `Array.isArray(data) ? data : data.items` tarzida ishlatish kifoya (agar hozirdan boshlab har doim `limit` yuborilsa, har doim `{items, next_cursor}` keladi). `next_cursor === null` bo'lsa — oxirgi sahifa.

## Sinov natijalari
36 test (`lib/pagination.ts` + 3 endpoint), 16/16 mutatsiya. To'liq to'plam: 1064/1064, `tsc` toza.
