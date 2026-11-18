# Darslik videosi yuklash — "Upload tugatilmadi" xatosi tuzatildi

## Sabab
Ikkala darslik yaratish sahifasi (trener va admin) video yuklashda **eskirgan, R2'ning o'z qoidasiga zid** usuldan foydalanar edi:
- Fayl 3.5MB'dan bo'laklarga bo'linib, har bir bo'lak serverga (Vercel) yuborilib, undan R2'ga uzatilardi.
- **R2 (S3-mos) qoidasi**: multipart yuklashda oxirgisidan boshqa HAR BIR bo'lak kamida **5 MiB** bo'lishi shart.
- 3.5MB — bu chegaradan kichik, shuning uchun bir nechta bo'lakdan iborat deyarli HAR QANDAY video (ya'ni deyarli har doim) yuklanish jarayonining oxirida — "yakunlash" (`CompleteMultipartUpload`) bosqichida R2 tomonidan rad etilardi. Shu daqiqada "Upload tugatilmadi" chiqadi.

Serverda (`/api/upload/init`) buning TO'G'RI yechimi — presigned-URL asosidagi usul — allaqachon mavjud edi (kodda "YANGI, tavsiya etiladi" deb belgilangan), lekin ikkala frontend sahifa ham hali ESKI usulni chaqirib turgan edi.

## Tuzatish
- Yangi umumiy yordamchi: `lib/upload-video-client.ts` — `uploadLessonVideo()`. Katta fayllarda endi:
  1. `/api/upload/init`ga `size` yuboriladi
  2. Server HAR BIR bo'lak uchun qisqa muddatli (presigned) R2 havolasini qaytaradi (bo'lak hajmi — serverdagi `UPLOAD_PART_SIZE = 8MB`, R2 talabiga mos)
  3. Brauzer bo'lakni **to'g'ridan-to'g'ri R2'ga** PUT qiladi (Vercel orqali o'tmaydi)
  4. `/api/upload/complete` bilan yakunlanadi
- `src/app/admin/lessons/create/page.tsx` va `src/app/(main)/lessons/create/page.tsx` — ikkalasi ham shu yordamchiga o'tkazildi.
- Mijoz tomonidagi "500MB" qattiq kodlangan chegara — serverda haqiqatda ishlatiladigan `LESSON_VIDEO_MAX_BYTES` (2GB)ga moslashtirildi, shu jumladan UI yorlig'i ("500MB gacha" → "2 GB gacha").
- R2 CORS (`r2-cors.json`) allaqachon to'g'ri sozlangan edi (PUT ruxsat, ETag ochiq) — o'zgartirish shart emas.

## Sinov natijalari
12 ta yangi test (kichik/katta fayl, init/bo'lak/yakunlash xatolari, progress, ETag yo'qligi) — barchasi o'tdi. Mutatsiya: 10/10 tutildi, jumladan aynan asl bug stsenariysini (3.5MB qattiq kodlangan bo'lak o'rniga serverning `partSize`si ishlatilishi) tekshiruvchi mutant ham. `tsc` toza, production build muvaffaqiyatli.
