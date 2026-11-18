# O'z-o'zidan akkauntni o'chirish

Play Market (va umuman zamonaviy ilova do'konlari) foydalanuvchidan o'z hisobini o'zi o'chira olishini talab qiladi. Hozirgacha faqat admin ban qila olardi.

## Muhim texnik qaror — nega Supabase Auth hisobi "so'zma-so'z" o'chirilmaydi

Bazada `profiles.id` ustuni `auth.users(id)` ga **`ON DELETE CASCADE`** bilan bog'langan, va o'z navbatida `purchases`, `reviews`, `posts`, `trainer_profiles` kabi jadvallar `profiles(id)`ga **yana CASCADE** bilan bog'langan. Bu shuni anglatadi: agar Supabase Auth hisobi **so'zma-so'z o'chirilsa**, bu zanjir bo'ylab **avtomatik ravishda** foydalanuvchining barcha xaridlari, sharhlari, postlari HAM butunlay yo'q qilinadi — bu esa "xaridlar tarixi anonimlashtirilib saqlansin" talabiga to'g'ridan-to'g'ri zid keladi.

**Shu sababli**: profilni o'chirish o'rniga **anonimlashtiramiz** (qatorni saqlab qolib, shaxsni aniqlaydigan maydonlarni tozalaymiz), va Auth hisobini "o'chirish" o'rniga **doimiy (muddatsiz) ban** qo'yamiz — bu allaqachon butun tizimda ishlatiladigan, sinovdan o'tgan mexanizm (`getApiUser` har bir so'rovda tekshiradi). Natija amalda bir xil: hisobga qayta kirib bo'lmaydi, lekin moliyaviy/tarixiy yozuvlar buzilmaydi.

## `DELETE /api/account`

1. **Trener bo'lsa**: `balance > 0` bo'lsa yoki kutilayotgan (`pending`) pul yechish so'rovi bo'lsa — rad etiladi ("Avval balansingizni yeching"). Bu ikkinchi tekshiruv (kutilayotgan so'rov) so'ralganidan ortiqcha, lekin muhim: aks holda trener balansini to'liq so'rab, keyin hisobni o'chirib yuborsa, Conor kimga pul o'tkazishini bilmay qoladi.
2. **Anonimlashtirish**: `profiles.full_name → "O'chirilgan foydalanuvchi"`, `avatar_url`/`phone → null`. Trener bo'lsa `trainer_profiles`dagi bio/zal ma'lumotlari tozalanadi, `is_published = false`, va barcha darsliklari `status = 'draft'` qilinadi — **xarid qilganlar kirishni davom ettiradi** (`is_purchased` orqali tekshiriladi, `status`ga bog'liq emas), faqat yangi sotuv to'xtaydi.
3. **Doimiy ban**: `user_bans` jadvaliga `expires_at: null` (muddatsiz) yozuv qo'shiladi, sabab: "Foydalanuvchi o'z hisobini o'chirdi".

## Frontend

Profil → Sozlamalar → "Xavfli zona"da yangi "Hisobni o'chirish" tugmasi. Bosilganda tasdiqlash oynasi chiqadi (oqibatlari tushuntiriladi). Tasdiqlansa: server so'rovi → muvaffaqiyatda avtomatik chiqish (signOut) va bosh sahifaga o'tkazish; xato bo'lsa (masalan balans) — sabab ko'rsatiladi, hech narsa o'zgarmaydi.

## Ilova (Android) uchun
`DELETE /api/account` (Bearer token bilan) chaqirilsa yetarli — xuddi shu javob formati (`{success:true}` yoki `{message: "..."}` + tegishli status kod).

## Sinov natijalari
Backend: 6/6 test, 10/10 mutatsiya. Frontend: 3/3 test, 3/3 mutatsiya. To'liq to'plam: 1047/1047, `tsc` toza.
