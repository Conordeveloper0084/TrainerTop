# `GET /api/posts?video=1` — faqat videoli postlar

Android ilovasidagi Reels lentasi uchun.

## Kontrakt
- `video=1` — faqat `video_url IS NOT NULL` postlar qaytadi (rasmli/matnli postlar chiqmaydi). Faqat aynan `1` qiymati (`true`, `0` va boshqalar — e'tiborsiz, eski xatti-harakat).
- **Cursor pagination** o'zgarmagan: `?video=1&limit=10&cursor=<created_at>` → `{ "items": [...], "next_cursor": "..." | null }`. `limit`/`cursor` bo'lmasa — massiv (eng ko'pi 50 ta).
- **Ban va blok filtrlari saqlanadi**: banlangan va shu ko'ruvchi bloklagan foydalanuvchilarning videolari chiqmaydi.
- `is_liked`, `is_verified`/`athlete_badge` kabi qo'shimcha maydonlar avvalgidek.
- `video` yuborilmasa — hozirgi xatti-harakat aynan o'sha-o'sha.

## Misol
```
GET /api/posts?video=1&limit=10
→ { "items": [ { "id": "...", "video_url": "https://...", "video_thumbnail_url": "...", ... } ], "next_cursor": "2026-09-20T10:00:00Z" }
```

## O'zgargan joy
`src/app/api/posts/route.ts` (GET). Testlar: `.tmp-test/routes4.test.ts` (3 ta yangi), mutatsiya 5/5.

Deploy: faqat kod (SQL kerak emas).
