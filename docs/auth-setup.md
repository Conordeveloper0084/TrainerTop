# Auth sozlash: email tasdiqlash + Google

## Tartib (muhim)
1. Kodni deploy qiling (ZIP-2). Confirm email hali O'CHIQ turadi — hech narsa buzilmaydi.
2. SMTP + DNS (Resend/Brevo) → Supabase SMTP Settings.
3. Supabase → Authentication → URL Configuration.
4. Email shablonlari (2 ta).
5. Google (Cloud Console → Supabase Providers).
6. Test akkaunt bilan tekshirib, OXIRIDA Confirm email'ni yoqing.

## Supabase URL Configuration
- Site URL: `https://www.trainertop.uz`
- Redirect URLs: `https://www.trainertop.uz/**`, `https://trainertop.uz/**`, `http://localhost:3000/**`

## Email shablonlari
Supabase → Authentication → Emails (Email Templates):
| Shablon | Subject | Body (fayl) |
|---|---|---|
| Confirm signup | `Trainertop: emailingizni tasdiqlang` | `docs/email-templates/confirm-signup.html` |
| Reset password | `Trainertop: parolni tiklash` | `docs/email-templates/reset-password.html` |

Havola `{{ .SiteURL }}/auth/confirm?token_hash=...` ko'rinishida — bu boshqa qurilmada (telefonda) ochilsa ham ishlaydi.
`{{ .Token }}` — 6 xonali kod (Android ilova uchun).

## Google
1. Google Cloud Console → yangi loyiha → OAuth consent screen: External, nomi Trainertop, authorized domain `trainertop.uz`,
   privacy `https://www.trainertop.uz/privacy`, terms `https://www.trainertop.uz/terms`, scope: openid, email, profile.
   Status: **In production**.
2. Credentials → OAuth client ID → Web application:
   - Authorized JavaScript origins: `https://www.trainertop.uz`, `https://trainertop.uz`, `http://localhost:3000`
   - Authorized redirect URI: Supabase → Authentication → Providers → Google sahifasidagi Callback URL
     (`https://<loyiha>.supabase.co/auth/v1/callback`)
3. Client ID va Client Secret → Supabase → Providers → Google → Enable → Save. (Secret'ni hech kimga yubormang.)
4. Vercel → Settings → Environment Variables: `NEXT_PUBLIC_GOOGLE_LOGIN` = `true` → **Redeploy**. Shundan keyin login/register sahifalarida
   "Google bilan davom etish" tugmasi paydo bo'ladi (bundan oldin yashirin turadi).

## Oqimlar (kod tomoni)
- Ro'yxatdan o'tish: Confirm email YOQIQ bo'lsa "Emailingizni tekshiring" ekrani, o'chiq bo'lsa eski oqim.
- Login: "tasdiqlanmagan" bo'lsa qayta yuborish tugmasi.
- Havola: `/auth/confirm` → `/auth/confirmed`.
- Parolni tiklash: `/forgot-password` → email → `/auth/confirm?type=recovery` → `/reset-password`.
- Google: `/auth/callback` (yangi akkaunt `user` bo'ladi; `/register?role=trainer` orqali kelgan YANGI akkaunt trener bo'ladi).
- Trener bo'lish: `POST /api/become-trainer` → `{ "role": "trainer" | "admin" }` (Bearer yoki cookie; admin o'zgarmaydi; idempotent).

## Android ilova uchun eslatma
- Confirm email yoqilgach `signUp` sessiya QAYTARMAYDI — ilova "kod kiriting" ekraniga o'tishi kerak:
  `verifyOtp(type = signup, email, token = <6 xonali kod>)`.
- Parolni tiklash: `resetPasswordForEmail` → kod → `verifyOtp(type = recovery)` → `updateUser(password)`.
- Google (ilovada) uchun alohida Android OAuth client va SHA-1 kalitlari kerak.

## Mavjud soxta emailli akkauntlarni ko'rib chiqish (faqat o'qish, hech narsa o'chirmaydi)
```sql
select split_part(email, '@', 2) as domain, count(*) from public.profiles group by 1 order by 2 desc;
select email, role, created_at from public.profiles order by created_at desc limit 100;
```
