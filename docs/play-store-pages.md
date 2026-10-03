# Google Play uchun: Maxfiylik, Shartlar, Akkauntni o'chirish

Play Console talablari uchun uchta login'siz ochiladigan sahifa to'liq qayta yozildi (kodni auditdan o'tkazib, faqat haqiqatda ishlatilayotgan xizmat va ma'lumotlar yozilgan).

## Sahifalar
- **`/privacy`** — Maxfiylik siyosati. O'zbek (standart) + ingliz (`?lang=en`), yuqorida UZ/EN almashtirish tugmasi. Supabase, Vercel, Cloudflare, Click, Resend, Google, OpenAI, Firebase FCM/Crashlytics, Telegram — barchasi aniq yozilgan, faqat kodda bor narsalar.
- **`/terms`** — Foydalanish shartlari. O'zbek + ingliz. Yangi: foydalanuvchi kontenti (UGC) qoidalari — taqiqlangan kontent turlari, shikoyat/bloklash imkoniyati, ban.
- **`/delete-account`** — Akkauntni o'chirish. Faqat o'zbek (Conor so'ragan ko'lam shunday edi). Login'siz ochiladi; agar foydalanuvchi tizimga kirgan bo'lsa, sahifaning o'zida mavjud `DELETE /api/account`ni ishlatadigan "Hisobimni hozir o'chirish" tugmasi chiqadi (tasdiqlash oynasi bilan). Ilovada va saytda qanday o'chirish, nima o'chirilib-nima saqlanishi (anonimlashtirish), qancha vaqtda bajarilishi, va tizimga kira olmaganlar uchun email/Telegram orqali murojaat yo'li tushuntirilgan.

## Qo'shimcha o'zgarishlar
- `lib/constants.ts`: `SUPPORT_EMAIL` — yagona konstanta (hozircha `Trainertop_support@gmail.com`). Boshqa emailga o'tish uchun shu bitta joyni o'zgartirish kifoya, barcha 3 sahifada avtomatik yangilanadi.
- Footer'ga "Akkauntni o'chirish" havolasi qo'shildi (Maxfiylik va Shartlar allaqachon bor edi).
- Ro'yxatdan o'tish formasiga (`/register`) rozilik matni qo'shildi: "Ro'yxatdan o'tib, Foydalanish shartlari va Maxfiylik siyosatiga rozilik bildirasiz" (ikkala so'z ham havola).

## Diqqat talab qiladigan joy
Email: hozircha `Trainertop_support@gmail.com` ishlatildi (avval ma'lum bo'lgan manzil). Agar Play Console uchun alohida yangi brend Gmail ochgan bo'lsangiz, `SUPPORT_EMAIL` qiymatini shunga almashtiring.

`/delete-account`dagi "Ilovada qanday o'chiriladi" bo'limi taxminiy menyu yo'li bilan yozilgan (Profil → Sozlamalar → Hisobni o'chirish) — bu android ilovaning haqiqiy menyu nomlariga mos kelishini o'zingiz tekshirib, kerak bo'lsa matnni to'g'rilang.

## Sinov natijalari
TS/JS: 14 ta yangi test (til almashtirish, DeleteAccountPanel barcha holatlari, footer havolasi, ro'yxatdan o'tish rozilik matni), mutatsiya 11/11. To'liq to'plam 1171/1171, `tsc` toza, production build muvaffaqiyatli.
