# Test/mock ma'lumotlarni xavfsiz tozalash

Play yopiq testidan oldin test akkauntlarni tozalash uchun. **O'qing: bu funksiyalar "ko'r-ko'rona o'chirish" EMAS** — agar o'chirilayotgan trenerning darsligini saqlanishi kerak bo'lgan boshqa foydalanuvchi sotib olgan yoki uning chat guruhida saqlanishi kerak bo'lgan boshqa a'zo bo'lsa, **butun operatsiya rad etiladi** (hech narsa o'chmaydi) — bu boshqa odamning ma'lumotini tasodifan yo'qotib qo'yishdan himoya.

## Zaxira nusxa olish (ISHGA TUSHIRISHDAN OLDIN)

**Tez yo'l (Supabase Dashboard):** Project → Database → Backups. Agar Pro reja bo'lsa, Point-in-Time Recovery (PITR) odatda yoqilgan bo'ladi — istalgan daqiqaga qaytarish imkonini beradi, alohida harakat shart emas, lekin ishga tushirishdan oldin **"Trigger a new backup"** tugmasi bo'lsa bosing.

**Ishonchli yo'l (`pg_dump`):** Supabase → Project Settings → Database → Connection string (URI, "Session pooler" emas, to'g'ridan-to'g'ri ulanish) ni oling, o'z kompyuteringizda (`psql`/`pg_dump` o'rnatilgan bo'lsa):
```
pg_dump "postgresql://postgres:[PAROL]@[HOST]:5432/postgres" -f trainertop-backup-$(date +%Y%m%d).sql
```
Bu butun bazani bitta faylga oladi — kerak bo'lsa qayta tiklash mumkin.

Ikkalasi ham bo'lmasa, hech bo'lmasa **1-bandning SQL natijasini CSV qilib eksport qiling** (Supabase SQL Editor'da natija jadvali ustidagi "Export to CSV" tugmasi) — bu kamida qaysi akkauntlar o'chirilganini qayd etadi.

## 1. Test akkauntlarni ko'rish (xavfsiz, hech narsa o'zgarmaydi)
Yuqorida berilgan SQL so'rovni Supabase SQL Editor'da ishga tushiring. `likely_test_email` ustuni faqat vizual yordam.

## 2. Himoyalangan akkauntlar (hech qachon o'chirilmaydi)
Google Play tekshiruvchi demo akkauntlarini **o'zingiz** shu SQL bilan qo'shing (kodda emas, faqat bazada):
```sql
INSERT INTO public.protected_accounts (email, note) VALUES
  ('demo-user@sizning-domen.uz', 'Google Play reviewer — oddiy foydalanuvchi'),
  ('demo-trainer@sizning-domen.uz', 'Google Play reviewer — trener')
ON CONFLICT (email) DO NOTHING;
```
Bu ro'yxatdagi email'ga ega akkauntni o'chirishga urinish **har doim** butunlay rad etiladi — boshqa hech qanday sozlama buni aylanib o'tolmaydi.

## 3. Migratsiya va API
**SQL**: `supabase/migration-v27-account-purge.sql` (v12, v26'ga bog'liq; mustaqil, qayta ishga tushirsa xavfsiz).

### `POST /api/admin/accounts/preview-delete`
```
← { "profile_ids": ["uuid1", "uuid2"] }
→ { "report": [
      { "profile_id": "uuid1", "found": true, "email": "...", "protected": false, "blocked": false, "blockers": [], "counts": {...} },
      { "profile_id": "uuid2", "found": true, "protected": true, "blocked": true, "blockers": [...] }
    ] }
```
`blockers` turlari: `external_purchase` (boshqa foydalanuvchi shu trenerning darsligini sotib olgan), `external_group_member` (boshqa foydalanuvchi shu trenerning chat guruhida faol a'zo).

### `POST /api/admin/accounts/delete` — HAQIQIY O'CHIRISH
```
← { "profile_ids": ["uuid1", "uuid2"], "confirm": true }
→ 200 { "deleted": ["uuid1", "uuid2"], "r2": { "requested": 12, "deleted": 11, "failedKeys": [...] } }
→ 409 { "message": "Himoyalangan akkaunt o'chirib bo'lmaydi: ..." }      // yoki to'siq bo'lsa
```
Bazadagi o'chirish **bitta SQL tranzaksiyasi — atomik**: ro'yxatdagi BITTA akkaunt himoyalangan yoki bloklangan bo'lsa, **hech biri o'chmaydi**. Muvaffaqiyatli bo'lgandan KEYIN (baza allaqachon o'zgargach) R2'dagi fayllar (avatar, post rasm/video, darslik videolari, chat media) best-effort tarzda tozalanadi — bu alohida bosqich, chunki R2 Postgres tranzaksiyasining bir qismi bo'la olmaydi.

### Bitta kontent (akkauntni qoldirib)
`POST /api/admin/content/preview-delete` va `POST /api/admin/content/delete` — xuddi shunday, `{type: "post"|"lesson", id, force?, confirm: true}`. To'langan xaridi bor darslik standart holatda rad etiladi; `force: true` bilan xaridlar bilan birga o'chadi.

## 4. O'chirilganda nima bo'ladi
Trener/foydalanuvchi profili bilan birga: postlar, darsliklar, xaridlar (xaridor HAM, sotuvchi HAM sifatida), izohlar, like'lar, obunalar (follow), 1:1 va guruh chatlari, sharhlar, push token'lar, pul yechish kartasi, pul yechish so'rovlari, hisob-kitob yozuvlari (trainer_ledger) — hammasi. Click to'lov jurnali (`click_transactions`) **o'chirilmaydi**, faqat foydalanuvchi bog'lanishi uziladi (moliyaviy jurnal saqlanadi).

## Sinov natijalari
SQL: 57 test (real Postgres), 24/27 mutatsiya tutildi (3 tasi asosli equivalent — izohlangan). JS: 51 yangi test (R2 tozalash + 4 ta API endpoint), barcha mutatsiya tutildi. `tsc` toza, 16 ta migratsiya (v3-v27) birga xatosiz ishlaydi.
