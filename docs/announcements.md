# Rasmiy TrainerTop kanali — e'lonlar (v16 / ZIP v8)

> **Yangilandi (v20 / ZIP v11):** video qo'llab-quvvatlash, ixtiyoriy sarlavha, kanal identifikatori (nom/rasm/bio/@username), Chat ichidan yozish. Batafsil: `docs/channel.md`.


## Nima qo'shildi
- **Admin › E'lonlar**: e'lon yozish (sarlavha ≤80, matn ≤2000, ixtiyoriy rasm, ixtiyoriy tugma: havola + yozuv), **namuna** (foydalanuvchida qanday ko'rinishini jonli ko'rsatadi), yuborish oldidan tasdiq, tarix.
- **Auditoriya**: **hammaga** yoki **bitta tanlangan foydalanuvchiga** (ism/email bo'yicha qidiriladi). Rol bo'yicha (faqat trenerlarga...) hozircha yo'q — kerak bo'lsa keyin qo'shiladi.
- **Foydalanuvchida**: chat ro'yxatida AI ostida **"TrainerTop · RASMIY"** qatori (oxirgi e'lon sarlavhasi, o'qilmagan soni). Ichida — faqat o'qish kanali: e'lonlar kartochka bo'lib chiqadi (rasm, tugma), shaxsiy xabarlar "Sizga shaxsiy xabar" belgisi bilan. Pastda "Yordamga yozing" havolasi (`/support`). Kanalga javob yozib bo'lmaydi.
- **Belgi**: o'qilmagan e'lonlar **chat belgisiga** qo'shiladi va **qo'ng'iroqchada** "TrainerTop: yangi e'lon" qatori chiqadi (bosilsa kanal ochiladi). Bu qator qo'ng'iroqchani ochish bilan yo'qolmaydi — faqat **kanal ochilganda** yo'qoladi.
- **Qaytarib olish**: admin e'lonni o'chirsa, u kanaldan hamma uchun yo'qoladi (tarixda "O'chirilgan" bo'lib qoladi).
- **Statistika**: hammaga e'lon uchun "N kishiga · M tasi kanalni ochgan"; shaxsiy uchun "Ochib ko'rgan / Hali ochmagan".

## Qanday ishlaydi (nega arzon)
1 ta e'lon = jadvalda **1 ta qator** (har foydalanuvchiga alohida qator yozilmaydi — 100 ming foydalanuvchida ham bir xil arzon). O'qilganlik — har foydalanuvchida bitta "oxirgi ko'rgan vaqt" (`announcement_reads`). O'qilmagan = ko'rgan vaqtidan keyin yuborilgani. **Yangi ro'yxatdan o'tgan odam eski e'lonlarni o'qilmagan deb ko'rmaydi** (tarixni kanalda o'qiy oladi).

## Xavfsizlik
- Jadvallar va funksiyalar faqat server (`service_role`); brauzer tegolmaydi (RLS + huquqlar).
- Yuboruvchi admin ekanligi **bazaning o'zida** ham tekshiriladi.
- **Havola**: faqat sayt ichidagi yo'l (`/lessons`) yoki `https://`. `javascript:`, `data:`, `http:`, `//evil.com`, `user:pass@` rad etiladi — yuborishda ham, ko'rsatishda ham (bazada xavfli havola qolib ketsa ham chizilmaydi).
- **Rasm**: faqat shu adminning o'zi yuklagan fayl (`posts/` yoki `uploads/`, bizning R2'dan).
- Matn faqat **matn** sifatida chiqadi (HTML ishlamaydi).
- **Ikki marta bosishdan himoya**: har yuborishga `client_token` — takroriy so'rov yangi e'lon yaratmaydi.
- **Tezlik chegarasi**: bir admin soatiga ko'pi bilan **5 ta "hammaga"** e'lon (xato bosish yoki buzilgan hisobdan himoya). Shaxsiy e'lonlarga chegara yo'q.
- Foydalanuvchiga faqat ko'rsatishga kerakli maydonlar boradi (kim yuborgani, auditoriya soni, nishon id — yo'q).
- Har yuborish/o'chirish **audit jurnaliga** yoziladi.

## Deploy tartibi (MUHIM)
1. Supabase → SQL Editor → `supabase/migration-v16-announcements.sql` (qayta ishga tushirsa xavfsiz). Oxirida "TEKSHIRUV": birinchi ikki qator `OK`, uchinchisi e'lonlar soni (0).
   - Bu migratsiya **faqat `profiles`ga tayanadi** — v13/v15 talab qilmaydi (lekin ular allaqachon bajarilgan bo'lishi kerak).
2. **Shundan keyin** kodni push qiling. Yangi env o'zgaruvchisi **kerak emas**.

Tartib buzilsa: kod SQL'dan oldin chiqsa — chat va qo'ng'iroqcha **buzilmaydi** (e'lon funksiyasi topilmasa hisobga olinmaydi, kanal shunchaki ko'rinmaydi); faqat admin sahifasi xato beradi.

## API (ilova ham shundan foydalanadi)
| Yo'l | Vazifasi |
|---|---|
| `GET /api/announcements?before=` | Kanal (hammaga + menga shaxsiy), eskisi → yangisi, 30 tadan. Birinchi sahifa kanalni "o'qildi" qiladi |
| `GET /api/announcements/summary` | `{unread, latest}` — chat ro'yxatidagi qator uchun |
| `GET /api/chat/unread` | `{count}` — endi kanal e'lonlari ham qo'shilgan |
| `GET /api/notifications` | Endi **cookie YOKI Bearer** (ilova uchun ham ishlaydi). O'qilmagan e'lon bo'lsa boshida `sticky` qator (`href: "/chat?official=1"`) |
| `POST /api/admin/announcements` | `{kind: "all"\|"user", target_user_id?, title, body, image_url?, link_url?, link_label?, client_token?}` |
| `GET /api/admin/announcements` | Tarix + auditoriya soni |
| `DELETE /api/admin/announcements/[id]` | Qaytarib olish |

Chuqur havola: `/chat?official=1` kanalni ochadi.

## Ilova (Android) uchun
Ilova chat ro'yxatida `GET /api/announcements/summary` dan "TrainerTop" qatorini chizadi, ichida `GET /api/announcements` ni ko'rsatadi (faqat o'qish). Push-bildirishnoma keyinroq (ilova bosqichida) — hozir belgi so'rov (poll) orqali yangilanadi. `/api/notifications` endi Bearer bilan ishlaydi.

## Sinov natijalari
- Haqiqiy Postgres: v16 **52/52**; eski to'plamlar buzilmagan (v12 122, v13 78, v14 64, v15 76, backfill 16).
- SQL mutatsion sinov: 44 ta ataylab buzilgan variant — 43 tasi ushlandi, 1 tasi ekvivalent (takroriy CHECK).
- JS: **649/649** (22 fayl). Mutatsion sinov: 91 ta variant — real xatolarning hammasi ushlandi, 4 tasi ekvivalent (natijasi o'zgarmaydigan).
- Production build muvaffaqiyatli (78/78 sahifa; yangi API yo'llari dinamik `ƒ`, `/admin/announcements` sahifasi bor). Build vaqtidagi `ENOTFOUND x.supabase.co` va `Dynamic server usage` xabarlari soxta env qiymatlaridan chiqadigan odatiy shovqin.

## Keyingi bosqich
Darslikni admin "boost" qilishi (yaxshi yangi darslik rasmiy kanalga tushadi) · trenerning o'z followerlari ro'yxati · atlet bloglari va ikki nishon ("TrainerTop Trener" / "TrainerTop Athlete") · umumiy 5 yulduzli baho.

> **Yangilanish (v17):** darslikni boost qilish (rasmiy kanalda darslik kartochkasi) — `docs/lesson-boost.md` ga qarang. `announcement_summary` va `admin_announcement_list` v17 da kengaytirilgan.
