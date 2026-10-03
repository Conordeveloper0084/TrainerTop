# Darslikni boost qilish (v17 / ZIP v9)

## Nima qo'shildi
- **Admin › Darsliklar**: har **e'lon qilingan** darslik kartochkasida 🚀 **Boost** tugmasi (qoralama va o'chirilganlarda yo'q).
- Bosilsa oyna ochiladi: qisqa matn (ixtiyoriy, ≤300 belgi), foydalanuvchida qanday ko'rinishining **namunasi**, va holat: "Oxirgi 7 kunda: X/2 boost ishlatilgan".
- Tasdiqdan keyin darslik **hamma** foydalanuvchining rasmiy «TrainerTop» kanalida **darslik kartochkasi** bo'lib chiqadi: muqova, nom, trener, narx (o'zgarsa yangisi ko'rinadi), "Darslikni ko'rish" tugmasi. Kanaldan tashqari joyda (Darsliklar sahifasi va h.k.) hech narsa o'zgarmaydi.
- **Trenerga** qo'ng'iroqchada "Darsligingiz TrainerTop kanalida tavsiya qilindi" xabari boradi; bosilsa darsligiga olib boradi. (Platforma darsligi bo'lsa xabar yuborilmaydi.)
- **Admin › E'lonlar** tarixida boost qatorlari "Boost" belgisi bilan va **natija** ko'rsatiladi: "Boostdan keyin 7 kunda: N ta sotuv".

## Qoidalar (hammasi bazada, chetlab o'tib bo'lmaydi)
- Faqat admin; faqat **e'lon qilingan** darslik; banlangan trenerniki emas.
- **Reklama charchog'idan himoya**: butun platforma bo'yicha **7 kunda ko'pi bilan 2 ta** boost. Qaytarib olingan boost ham sanaladi (o'chirib qayta qilib aylanib o'tib bo'lmaydi).
- Bir darslik **30 kunda bir marta** (qaytarib olingan bo'lsa qayta qilish mumkin, 7 kunlik chegara saqlanadi).
- **Ikki marta bosishdan himoya** (`client_token`): takroriy so'rov yangi boost yaratmaydi va trenerga ikkinchi xabar bormaydi.
- Kartochka **darslik holatiga bog'liq**: darslik qoralamaga o'tsa/admin olib tashlasa yoki trener banlansa — kartochka kanaldan va o'qilmagan sonidan **avtomatik yo'qoladi**, qayta e'lon qilinsa qaytadi. Darslik butunlay o'chirilsa uning boost e'loni ham o'chadi.
- Har boost **audit jurnaliga** yoziladi.

## Deploy tartibi (MUHIM)
1. Supabase → SQL Editor → `supabase/migration-v17-lesson-boost.sql` (qayta ishga tushirsa xavfsiz). Oxirida "TEKSHIRUV": birinchi ikki qator `OK`, uchinchisi `0`.
   - **Shundan keyin migration-v16 ni qayta ishga tushirmang** (u `announcement_summary` va `admin_announcement_list` ning eski variantini qaytaradi). Kerak bo'lsa: v16, keyin v17.
2. **Shundan keyin** kodni push qiling. Yangi env o'zgaruvchisi **kerak emas**.

Tartib buzilsa: kod SQL'dan oldin chiqsa — foydalanuvchi kanali (lenta) ochilmay qoladi (`announcement_feed` funksiyasi yo'q), chat va qo'ng'iroqcha buzilmaydi. Shuning uchun **SQL'ni avval** ishga tushiring.

## API
| Yo'l | Vazifasi |
|---|---|
| `POST /api/admin/lessons/[id]/boost` | `{text?, client_token?}` — boost qilish |
| `GET /api/admin/lessons/[id]/boost` | `{used_7d, limit_7d, last_boost_at, cooldown_days}` |
| `GET /api/announcements` | Kanal lentasi — endi boost kartochkasi `lesson` obyekti bilan keladi (`id, title, cover_image_url, price*, pricing_model, trainer_name`); oddiy e'londa `lesson: null` |
| `GET /api/notifications` | Trenerning boost xabarida `href: "/lessons/<id>"` |

## Ilova (Android) uchun
Kanal lentasidagi elementda `lesson` bo'lsa — darslik kartochkasi (muqova, nom, trener, narx, "Darslikni ko'rish" → darslik sahifasi), bo'lmasa oddiy e'lon. Boost qilish faqat veb-adminda.

## Sinov natijalari
- Haqiqiy Postgres: v17 **58/58**; v16 to'plami v17 qo'shilgan holda ham o'tadi (53/53); eskilari buzilmagan (v12 122, v13 78, v14 64, v15 76, backfill 16).
- SQL mutatsion sinov: 57 ta ataylab buzilgan variant — 55 tasi ushlandi; qolgan 2 tasi ekvivalent (huquqlar v16 da allaqachon yopilgan, takroriy `REVOKE`).
- JS: **687/687** (24 fayl). Mutatsion sinov: 51 ta variant — hammasi ushlandi.
- Production build muvaffaqiyatli (78/78 sahifa; `/api/admin/lessons/[id]/boost` yo'li dinamik `ƒ`). Build vaqtidagi `ENOTFOUND x.supabase.co` va `Dynamic server usage` xabarlari soxta env qiymatlaridan chiqadigan odatiy shovqin.

## Keyingi bosqich
Trenerning o'z followerlari ro'yxati (v10) · atlet bloglari va ikki nishon (v11) · umumiy 5 yulduzli baho (v12).
