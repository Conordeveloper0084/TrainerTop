# Video post — sozlash va API kelishuvi

## 1. Deploy tartibi (MUHIM)
1. `supabase/migration-v11-video-posts.sql` ni Supabase SQL Editor'da ishga tushiring.
2. Cloudflare R2 bucket'da CORS sozlang (pastda).
3. Shundan keyin kodni GitHub'ga push qiling.

## 2. R2 CORS (brauzer videoni to'g'ridan-to'g'ri R2'ga yuklashi uchun)
Cloudflare Dashboard → R2 → `trainertop-media` → Settings → CORS Policy → Add/Edit:

```json
[
  {
    "AllowedOrigins": ["https://www.trainertop.uz", "https://trainertop.uz", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
`ExposeHeaders: ["ETag"]` shart — usiz brauzer bo'lak ETag'ini o'qiy olmaydi va yuklash tugamaydi.
Origin oxirida `/` bo'lmasin.

## 3. API kelishuvi (website va Android app uchun)

### Post javobidagi yangi maydonlar (`GET /api/posts`, `POST /api/posts`, `GET /api/trainers/{id}` → `posts[]`)
| maydon | tur | izoh |
|---|---|---|
| `video_url` | string \| null | Video bo'lsa MP4/MOV/WebM havolasi. Video postda `images` = `[]` |
| `video_thumbnail_url` | string \| null | Muqova (JPEG). Bo'lmasligi mumkin |
| `video_duration` | int \| null | soniyada, 1..180 |

### Yuklash oqimi (video)
1. `POST /api/upload/init` `{ "fileName", "fileType": "video/mp4|video/quicktime|video/webm", "folder": "posts", "size": <bayt> }`
   → `{ uploadId, key, publicUrl, partSize, parts: [{ partNumber, url }] }`
2. Har bir bo'lakni (`partSize` = 8 MiB, oxirgisi kichik bo'lishi mumkin) `PUT parts[i].url` ga **to'g'ridan-to'g'ri R2'ga** yuboring
   (Authorization header YUBORMANG). Javob header'idagi `ETag` ni saqlang.
3. `POST /api/upload/complete` `{ uploadId, key, parts: [{ partNumber, etag }] }` → `{ success: true, url }`
4. Muqova (ixtiyoriy): `POST /api/upload` (multipart form: `file` = JPEG, `bucket` = `posts`) → `{ url }`
5. `POST /api/posts` `{ caption?, video_url, video_thumbnail_url?, video_duration }`

### Qoidalar (server tekshiradi)
- Video yuklash va video post — faqat `trainer` va `admin` rollari (403 aks holda).
- Maksimum 300 MB, 180 soniya (davomiylikni server o'lchay olmaydi — klient tekshiradi, server faqat hajmni HEAD bilan tekshiradi).
- Post rasm YOKI video, ikkalasi birga emas (400).
- `video_url` shu foydalanuvchining `posts/<userId>/...` papkasidagi R2 fayli bo'lishi shart.
- `DELETE /api/posts/{id}` — o'z postini (yoki admin) o'chiradi, R2 fayllari ham tozalanadi.

### Ommaviy trener API o'zgarishi
`GET /api/trainers` va `GET /api/trainers/{id}` endi `email`, `card_number`, `card_holder`, `balance`, `total_earned` qaytarmaydi.
