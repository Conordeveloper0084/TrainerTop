# Guruh moderatsiyasi, admin guruhlar paneli va Telegram murojaatlari (v15 / ZIP v7)

## Nima qo'shildi

### 1. A'zoga chora — ikki bosqichli (trener va admin uchun bir xil)
| Chora | Nima bo'ladi |
|---|---|
| **Yozishni cheklash (mute)** | 1 kun / 7 kun / 30 kun / muddatsiz. A'zo guruhni **o'qiy oladi**, yoza olmaydi. Muddat tugagach **o'zi tiklanadi** (cron kerak emas). Yozish panelining o'rnida sabab va muddat ko'rsatilgan banner turadi. |
| **Guruhdan chiqarish** | A'zo guruh xabarlarini ko'rmaydi, lekin guruh uning chat ro'yxatida **qoladi** (qizil "Guruhdan chiqarilgansiz · sabab"). Ichiga kirsa: kim chiqargani, sabab, izoh. **Darslikka kirishi SAQLANADI** (guruh haqida gap ketyapti, xarid haqida emas). Qayta to'lab kira olmaydi — faqat qaytarilsa. |
| **Qaytarish / cheklovni olib tashlash** | Trener guruh profilidan (Chiqarilganlar bo'limi) yoki admin panelidan. |

- **Sabab MAJBURIY**: 18+ kontent · Haqorat/so'kinish · Spam/reklama · Mavzudan tashqari · Boshqa (izoh ≥3 belgi majburiy). Izoh ≤500 belgi. Sabab a'zoning o'ziga ko'rsatiladi, **boshqa a'zolarga ko'rsatilmaydi**.
- A'zo chiqarilgan guruhni ro'yxatdan **olib tashlashi** mumkin (holat `removed` qoladi — yashiriladi xolos, qayta kira olmaydi).
- **Admin qo'ygan chorani trener bekor qila olmaydi** (mute ham, chiqarish ham; chiqarib-qaytarib aylanib o'tib ham bo'lmaydi). Faqat admin o'zgartiradi. Admin cheklovi muddati tugasa — trener yana chora ko'ra oladi.
- Har bir chora **jurnalga** yoziladi (`chat_group_actions`: kim, kimga, nima, sabab, muddat) va a'zoga **bildirishnoma** (qo'ng'iroqcha) boradi.
- Trener o'ziga, guruh egasiga chora ko'ra olmaydi. Hamma qoidalar DB funksiyasida (`chat_group_moderate`), brauzer chaqira olmaydi.

### 2. Xabarga shikoyat
Guruhda ham, 1:1 da ham boshqaning xabarida kichik bayroq (🚩). Sabab tanlanadi → admin panelida "Shikoyatlar". Xabar o'chirilsa ham **nusxasi** (snapshot) qoladi. Bir kishi bir xabarga bir marta; kuniga 20 tagacha. Admin: xabarni o'chirish / chora ko'rildi / rad etish / qayta ochish.

### 3. Admin › Guruhlar (yangi bo'lim)
- **Ro'yxat**: barcha guruhlar, qidiruv (guruh/darslik/trener), saralash (faollik · a'zolar · xabarlar · shikoyatlar). Har guruh: a'zo, chiqarilgan, cheklangan, 7 kunlik xabar, yozgan odamlar, trener xabarlari, ochiq shikoyatlar, **belgi**: Jonli (7 kunda ≥5 xabar va ≥2 kishi) · Sust · Jim · Bo'sh · Yopilgan.
- **Guruh sahifasi**: trener **javob tezligi** (30 kunda a'zo xabaridan keyin 48 soat ichida birinchi trener xabarigacha mediana), xabar turlari, 14 kunlik grafik, eng faol yozuvchilar; **barcha xabarlarni o'qish** (o'chirish mumkin; birinchi ochilish audit jurnaliga yoziladi); a'zolar va chora tarixi (admin chora ko'radi); guruhni yopish/qayta ochish.
- **AI tahlil** (faqat "tahlil qilish" bosilganda): oxirgi ~100 ta matnli xabar → guruh foydali/aralash/mavzudan tashqari/muammoli, mavzu foizi, misollar, e'tibor talab qiladigan holatlar, admin uchun tavsiya. Mavjud `OPENAI_API_KEY` ishlatiladi (`gpt-4o-mini`). **Ismlar va id'lar AI'ga yuborilmaydi** ("Trener", "A'zo 1"...), rasm/ovoz/video yuborilmaydi. Natija 1 soat saqlanadi (qayta bosilsa pul sarflanmaydi); majburiy yangilash 5 daqiqadan tez emas.

### 4. Admin › Murojaatlar — Telegram bot bilan birlashgan
Sayt formasi va **@TrainerTop_Support_Bot** murojaatlari bitta qutida (filtr: Hammasi / Sayt / Telegram; TELEGRAM belgisi; botda "ishlanmoqda" bo'lsa ISHLANMOQDA). Telegram murojaatiga panelning o'zidan javob bersa — bot orqali foydalanuvchiga boradi.
- Javob yuborish uchun Vercel env'iga **`TELEGRAM_BOT_TOKEN`** (botning tokeni) kerak. Yo'q bo'lsa — Telegram murojaatlari faqat o'qiladi (panel buni yozib qo'yadi).
- Boshqa admin botda murojaat ustida "ishlanmoqda" qilgan bo'lsa — panel so'raydi (ikki marta javob bo'lmasin); baribir yuborsa bo'ladi.
- Foydalanuvchi botni bloklagan bo'lsa — yuborilmaydi va aytiladi.
- Telegramdagi rasm/fayllar server orqali ochiladi (**token brauzerga chiqmaydi**). Faqat oddiy rasmlar ekranda ochiladi; boshqa fayllar (html/svg/pdf...) faqat **yuklab olinadi** — foydalanuvchi yuborgan fayl saytda skript ishga tushira olmasin.
- **Cheklov**: panelda javob berilganda botning **adminlar chatidagi kartochkalari** yangilanmaydi (holat bazada `answered` bo'ladi, lekin Telegramdagi karta eski ko'rinishda qolishi mumkin). Bot o'z yozuvini yangilaydigan bo'lsa — keyin moslashtiramiz.

## Deploy tartibi (MUHIM)
1. Supabase → SQL Editor → `supabase/migration-v15-group-moderation.sql` (qayta ishga tushirsa xavfsiz). Oxirida "TEKSHIRUV": ikkalasi ham `OK`.
   - Oldingi migratsiyalar (v13, v14a) allaqachon ishlagan — ularni **qayta ishga tushirmang** (ayniqsa v13: u `group_access` va `chat_group_list` ning eski variantini qaytaradi).
2. **Shundan keyin** kodni push qiling.
3. (Ixtiyoriy, Telegramdan javob berish uchun) Vercel → Settings → Environment Variables → `TELEGRAM_BOT_TOKEN` = @BotFather bergan token → Redeploy.
4. `OPENAI_API_KEY` allaqachon bor (AI yordamchi ishlatadi) — yangi kalit kerak emas.

Tartib buzilsa: SQL'dan oldin kod chiqsa — chora ko'rish ishlamaydi (funksiya yo'q). Kod chiqmasdan SQL ishlasa — zarar yo'q (faqat chiqarilgan a'zolar ro'yxatda oddiy guruh kabi ko'rinib qoladi, ochsa "topilmadi").

## Ma'lumotlar bazasi
| Nima | Vazifasi |
|---|---|
| `chat_group_members` (+7 ustun) | `muted_until` (`infinity`=muddatsiz), `mod_reason`, `mod_note`, `mod_by`, `mod_by_admin`, `mod_at`, `dismissed_at` |
| `chat_group_actions` | Chora jurnali (faqat server) |
| `chat_reports` | Shikoyatlar + xabar nusxasi (faqat server) |
| `chat_group_analyses` | AI tahlil keshi (faqat server) |
| `group_access()` | Yangi holat `removed` (qolganlari o'zgarmagan) |
| `chat_group_list()` | Chiqarilgan guruhni sabab bilan qaytaradi; cheklov muddati |
| `chat_group_moderate(...)` | Yagona atomik chora funksiyasi (mute/unmute/remove/restore), barcha qoidalar shu yerda |
| `admin_group_stats(...)`, `admin_group_detail(...)` | Admin statistikasi (faqat service_role) |

## API
Trener: `PATCH /api/chat/groups/[id]/members/[userId]` `{action: mute|unmute|remove|restore, reason, note, duration}` (eski `{status}` shakli **rad etiladi** — sababsiz chiqarib bo'lmasin) · `POST /api/chat/messages/[id]/report`.
Xatolar: guruh xabarlari — `403 {code:"MUTED", muted_until, reason, note}` va `403 {code:"REMOVED"}`.
Admin: `/api/admin/groups` (ro'yxat), `/groups/[id]` (tafsilot), `/groups/[id]/messages`, `/groups/[id]/members` (+`/[userId]` PATCH), `/groups/[id]/analyze` (POST), `/messages/[id]` (DELETE), `/reports` (+`/[id]` PATCH), `/support/tg/[id]` (GET/POST), `/support/tg-file`.

## Sinov natijalari
- Haqiqiy Postgres: v15 **76/76**; eski to'plamlar v15 bilan birga: v12 122/122, v13 78/78, v14 64/64, backfill 16/16.
- SQL mutatsion sinov: 52 ta ataylab buzilgan variant — **52/52 ushlandi** (qoidalar, RLS/huquqlar, statistika).
- JS: **543/543** (sinov fayllari 20 ta). Mutatsion sinov: 117 ta buzilgan variant — 116 tasi ushlandi, 1 tasi ekvivalent (noma'lum DB xatosi baribir 500 bo'ladi).
- Production build muvaffaqiyatli (74/74 sahifa; yangi API yo'llari dinamik `ƒ`). Build vaqtidagi `Dynamic server usage` va `ENOTFOUND x.supabase.co` xabarlari — soxta env qiymatlaridan chiqadigan odatiy shovqin, oldingi yo'llarda ham bor.

## Keyingi bosqich (rejalashtirilgan, hali boshlanmagan)
Broadcast/e'lon tizimi · trener o'z followerlarini ko'rishi · atletlar uchun blog va ikkinchi nishon ("TrainerTop Trener" / "TrainerTop Athlete") · butun platformaga 5 yulduzli baho.
