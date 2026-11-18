# Moliya va admin (ZIP-3)

## O'rnatish tartibi — MUHIM
1. `supabase/migration-v12-finance-admin.sql` ni Supabase → SQL Editor'da **kodni deploy qilishdan OLDIN** ishga tushiring (qayta ishga tushirsa ham xavfsiz).
   Yangi kod bazadagi yangi funksiyalarni (`credit_click_sale`, `request_payout`, ...) chaqiradi — migration'siz Click to'lovi va pul yechish ishlamaydi.
2. Oxirida "TEKSHIRUV" jadvali chiqadi: ledger/triggerlar `OK`, nomos trenerlar `0`, purchases policy `1`, payouts policy `1`, sozlamalar `5`.
3. Keyin GitHub'ga push → Vercel deploy.

## Qoidalar
- **Pul yechish:** karta va egasi har safar kiritiladi (saqlanmaydi). Summa so'rov yuborilgan zahoti balansdan ushlab qolinadi. Admin rad etsa — sabab majburiy, summa qaytariladi va trenerga ko'rinadi.
- **Komissiya:** umumiy foiz Sozlamalarda (standart 10%). Alohida trener uchun Trenerlar sahifasidan (masalan 0%). Faqat keyingi sotuvlarga ta'sir qiladi.
- **TrainerTop Athlete nishoni:** avtomatik — obunachi ≥ 1000, reyting ≥ 4.5, sharhlar ≥ 10 (Sozlamalarda o'zgartiriladi). Avtomatik faqat beriladi; olib tashlash faqat admin. Admin istalgan trenerga qo'lda bera oladi.
- **Darslik moderatsiyasi:** admin hamma darslikni ko'radi (tahrirlay olmaydi — faqat platforma darsliklarini). Olib tashlash: sabab + "delete" yozish. Darslik yashiriladi, xaridlar/daromad tarixi saqlanadi, "O'chirilganlar" tabidan tiklash mumkin.
- **Ban:** muddatli (1/7/30 kun) yoki doimiy ("ban" yozib tasdiqlanadi). Sabab majburiy. Bazada + Supabase Auth'da amal qiladi. Ban qilingan trenerning profili/darsliklari/postlari ko'rinmaydi; balansi saqlanadi.
- **O'chirish:** moliyaviy tarixi (xarid, yechish, daromad) bor foydalanuvchi o'chirilmaydi — ban qilinadi. Sotuvi bor darslikni trener o'chira olmaydi — qoralamaga o'tadi.

## Hisob daftari
`trainer_ledger` — har bir pul harakati (sotuv, yechish, qaytarish) alohida qator. Balans = daftar yig'indisi (Trener dashboardida "Hisob-kitob tekshirildi" belgisi shuni ko'rsatadi; mos kelmasa admin panelda qizil ogohlantirish chiqadi).
