# Postlar — Android 1.4.x bilan tenglashtirish (website v49)

## Server o'zgarishi (SQL kerak EMAS)
`GET /api/posts`, `GET /api/trainers/{id}` (posts), `GET /api/athletes/{id}` (posts) — kirgan foydalanuvchi uchun har postga:
```json
{ "id": "...", "is_liked": true, "is_following": false, ... }
```
- `is_following` — joriy foydalanuvchi shu post muallifiga obuna bo'lganmi (`follows.follower_id = me AND trainer_id = author`).
- Mehmonda `is_liked` / `is_following` maydonlari UMUMAN yo'q.
- Bitta so'rov: `follows ... in("trainer_id", authorIds)` (N+1 emas), likes bilan parallel.
- Eski maydonlar o'zgarmadi — Android/iOS'ning eski versiyalari buzilmaydi.

## Klient
- `PostCaption` — bitta oqim (ism + matn), hashtag `#[\p{L}\p{N}_]+` ko'k, "… yana" joylashuv bo'yicha (3 / 8 qator).
- `PostMedia.Carousel` — birinchi rasm nisbati 0.8…1.91, `object-contain`, qora chetlar, "1/3", nuqtalar; nisbat `sessionStorage` (`tt_img_ratio`).
- `PostList` — /posts, trener va atlet sahifalari uchun bitta ro'yxat; like: optimistik → server `likes_count`; pending paytida qayta bosish yo'q.
- `follow-store` (Zustand) — obuna holati trener ID bo'yicha, hamma joyda bir xil.
- `trackPostView` — `/view` sessiyada post boshiga 1 marta.
- `/posts/create` — alohida sahifa (modal o'rniga).

## Ma'lum cheklov
Regex `'` (apostrof) ni o'z ichiga olmaydi: `#sog'lom` → faqat `#sog` ko'k. Android bilan bir xil; o'zgartirilsa — uchala platformada birga.
