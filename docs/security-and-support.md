# v6: xavfsizlik (yopish) + Support murojaatlari

## Nima o'zgardi

**Xavfsizlik**
1. **Email va telefon** endi ochiq kalit (anon) va boshqa foydalanuvchilar uchun **yopiq** (oldin `profiles`ni hamma o'qiy olardi).
2. **Trenerlarning pul ma'lumotlari** (`balance`, `total_earned`, `commission_rate`) brauzerdan yopildi.
3. **Eski saqlangan karta raqamlari** (`trainer_profiles.card_number/card_holder`) bazadan **o'chirildi**.
4. **Pullik darslik kontenti** (`lessons.content` — videolar, matnlar): API xaridor bo'lmagan odamga faqat modul va video **sarlavhalarini** beradi; bazada ustun ham brauzerdan yopiq.
5. Keraksiz brauzer yozish huquqlari olib tashlandi: `posts`, 1:1 `messages`, `lesson_questions` (javob yozish), `video_access_log`. Hammasi faqat API orqali (server).
6. Oylik to'lov: muddat mavjud obunaning **oxiridan** uzaytiriladi (ikki marta parallel to'langanda kunlar yo'qolmasin).

**Support**
- `/support` formasi endi haqiqatan yuboradi (oldin xabar hech qayerga bormasdi).
- Telegram havolasi to'g'rilandi: `@TrainerTop_Support_Bot`.
- Spamdan himoya: soatiga 3 ta (bir email) / 5 ta (bir IP), yashirin "asal tuzoq" maydoni. IP xom holda saqlanmaydi.
- Admin panel → **Murojaatlar**: ro'yxat (Yangi / Javob berilgan / Yopilgan), qidiruv, javob yozish, yopish/qayta ochish.
- Javob yetkazish: kirgan foydalanuvchiga **qo'ng'iroqcha** + email (agar `RESEND_API_KEY` sozlangan bo'lsa). Mehmonga faqat email; kalit yo'q bo'lsa panel "yetkazilmadi" deb ko'rsatadi va emailga qo'lda yozish havolasini beradi.

**Jadval nomlari:** murojaatlar `web_support_tickets` va `web_support_messages` jadvallarida saqlanadi. Nom ataylab shunday: bazada eskidan `support_tickets` / `support_messages` (botning eski versiyasidan va h.k.) bo'lishi mumkin va ularga TEGILMAYDI.

## DEPLOY TARTIBI (muhim!)

SQL ikki qismga bo'lingan, chunki maxfiy ustunlarni yopish eski kodni buzadi:

1. **Supabase → SQL Editor → `migration-v14a-security-support.sql`** ni ishga tushiring. U faqat qo'shimcha/xavfsiz o'zgarishlar qiladi; eski kod ham ishlayveradi. Oxirida "TEKSHIRUV" jadvali: hammasi `OK` / `0`.
2. **Kodni push qiling** (Vercel deploy). Tekshiring: login, profil sahifasi, darslik sahifasi (mehmon sifatida), `/support` formasini yuboring → admin panel → Murojaatlar'da ko'rinishi kerak.
3. **`migration-v14b-lock-columns.sql`** ni ishga tushiring. "TEKSHIRUV" jadvalida hammasi `yopiq (OK)` / `ochiq (OK)`. Keyin saytni yana tekshiring (login, profil, trenerlar va darsliklar ro'yxati).
   - Tasdiqlash: `set role anon; select email from public.profiles limit 1; reset role;` → **permission denied** bo'lishi kerak.
   - Agar nimadir buzilsa, darhol orqaga qaytarish: `GRANT SELECT ON public.profiles, public.trainer_profiles, public.lessons TO anon, authenticated;`

Yangi kod SQL ishga tushmagan bo'lsa ham ishlaydi (o'z profilini RPC bilan olishga urinadi, funksiya yo'q bo'lsa eski usulga o'tadi), shuning uchun 1→2→3 tartibida xavf yo'q.

## Dasturchi qoidasi (yangi)

`profiles`, `trainer_profiles`, `lessons` jadvallariga brauzerdan `select("*")` **ishlamaydi** (maxfiy ustunlar bor). Aniq ustunlarni yozing yoki server API (service_role) orqali oling. O'z profilingiz uchun `fetchMyProfile()` / `fetchMyTrainerProfile()` (`src/lib/my-profile.ts`).

Bu jadvallarga kelajakda **yangi ustun** qo'shsangiz, u sukut bo'yicha brauzerga **yopiq** bo'ladi (xavfsiz standart). Ochiq bo'lishi kerak bo'lsa: `GRANT SELECT (yangi_ustun) ON public.<jadval> TO anon, authenticated;`

## Hali qilinmagan (ataylab)

- **Kontent qulfi 2-bosqich:** video fayllar hamon ochiq R2 bucket'da. Xaridor havolani nusxalab tarqatishi mumkin. Uzoq muddatli yechim: xususiy bucket + imzolangan (signed) qisqa muddatli URL.
- **Sharhlar (reviews)** hamon xaridsiz yoziladi — bu mahsulot qarori (oflayn shogirdlar ham baho bersin-mi?). Nishon uchun reyting soxtalashtirilishi mumkin; qaror kutilmoqda.
- Telegram bot murojaatlarini shu panelga qo'shish va panelning o'zidan Telegramga javob yuborish (v7).
- `follows` jadvali hamon hamma uchun ochiq o'qiladi (v8'da trenerning obunachilar ro'yxati bilan yopiladi).
