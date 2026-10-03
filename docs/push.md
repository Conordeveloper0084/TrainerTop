# FCM push (Android ilova)

Yangi xabar va kanal e'lonlari haqida Android ilovaga push yuboradi. Xabar FAQAT `data` ko'rinishida (hamma qiymat string: `title`, `body`, `route`, `tag`), `notification` bloki YO'Q — ilova bildirishnomani o'zi chizadi va sozlamadagi tugmani hurmat qiladi. Android priority `HIGH`.

## Deploy tartibi (muhim)
1. **AVVAL SQL:** `supabase/migration-v25-device-tokens.sql` (v13 va v15 dan keyin; mustaqil, qayta ishga tushirsa xavfsiz).
2. Vercel'da yangi env o'zgaruvchisi: **`FIREBASE_SERVICE_ACCOUNT_JSON`**.
3. **KEYIN kod** (push).

SQL'dan oldin kod chiqib ketsa ham hech narsa buzilmaydi: push xatolari log'ga yoziladi, xabar yuborish davom etadi.

## Yangi env o'zgaruvchisi
`FIREBASE_SERVICE_ACCOUNT_JSON` — Firebase Console → Project settings → Service accounts → "Generate new private key" faylining **butun mazmuni**. Ikki ko'rinish qabul qilinadi: oddiy JSON (`{...}`) yoki base64 kodlangan JSON (Vercel ko'p qatorli qiymatda muammo qilsa). Kalit repoda saqlanmaydi. O'zgaruvchi yo'q yoki noto'g'ri bo'lsa push jimgina **o'chiq** (xato log'ga bir marta tushadi), boshqa hech narsa buzilmaydi.

Conor qiladigan ishlar: Firebase loyihasi ochish, `uz.trainertop` Android ilovasini qo'shish, `google-services.json`ni ilova `app/` papkasiga qo'yish, service account kalitini yuqoridagi env'ga qo'yish.

## Migration `migration-v25-device-tokens.sql`
- `device_tokens` — `id`, `user_id` (→ `profiles`, `ON DELETE CASCADE`), `token` (UNIQUE), `platform` (standart `'android'`), `created_at`, `last_seen_at`. RLS yoqilgan, anon/authenticated'ga yopiq (faqat service_role).
- `chat_group_members.last_push_at` — guruh throttle'i uchun (qo'shimcha ustun).
- `push_group_recipients(p_group, p_sender, p_throttle_seconds=60)` — guruh xabari uchun oluvchilarni tanlaydi va throttle'ni ATOMIK (bitta UPDATE…RETURNING) qo'llaydi: bir nechta serverless nusxa parallel ishlasa ham bir odamga daqiqada ikkinchi push ketmaydi.
- Foydalanuvchi o'chirilsa tokenlari CASCADE bilan ketadi; o'z-o'zidan akkaunt o'chirilganda (`DELETE /api/account`, anonimlashtirish) tokenlar aniq o'chiriladi.

## Endpointlar (Bearer va cookie auth, `getApiUser`)
- `POST /api/devices` `{token, platform?}` — upsert. Token boshqa foydalanuvchida bo'lsa `user_id` yangisiga o'tadi. `platform`: `android` (standart), `ios`, `web`. Javob `200 {success:true}`; token yo'q/noto'g'ri — 400; login yo'q — 401.
- `DELETE /api/devices` `{token}` — FAQAT o'zining tokenini o'chiradi (`request.json()` bilan o'qiladi). Token bazada bo'lmasa ham `200` (idempotent).

## Qachon yuboriladi
| Hodisa | Kimga | `title` | `body` | `route` = `tag` |
|---|---|---|---|---|
| Yangi 1:1 xabar | qabul qiluvchi | yuboruvchi ismi | matn / "Rasm" / "Ovozli xabar" / "Video" | `chat/<conversationId>` |
| Yangi guruh xabari | faol, yozishi cheklanmagan a'zolar (yuboruvchidan tashqari), guruh+foydalanuvchiga **daqiqasiga bittadan** | guruh nomi | `"<Ism>: <matn yoki Rasm/Ovozli xabar/Video>"` | `chat-group/<groupId>` |
| Kanal e'loni (admin yozgan) | `kind=all` — hamma, `kind=user` — faqat maqsad | kanal nomi | "Sarlavha: matn" yoki matn; matn bo'lmasa "Video"/"Rasm" | `channel` |

- Matn 100 belgigacha qisqartiriladi.
- **Guruh `body`** ataylab "Ism: matn" ko'rinishida (guruhda kim yozgani muhim). Ilova `title`/`body`ni o'zgartirmasdan ko'rsatsa bas.
- Guruhda "faol" = a'zolik faol, xarid to'langan va muddati tugamagan (yoki trener), guruh arxivlanmagan, darslik olib tashlanmagan.
- **Yuborilmaydi:** ban qilingan foydalanuvchilarga; yuboruvchi bilan o'zaro bloklangan (ikki tomonlama) foydalanuvchilarga; yuboruvchining o'ziga.
- Darslik "boost" e'loni (lesson_boost) uchun push yuborilmaydi — faqat adminning o'zi yozgan kanal e'lonlari uchun.

## Yuborish qoidalari (`src/lib/push.ts`)
- FCM HTTP v1; service account'dan OAuth (JWT RS256), access token keshlanadi (muddatiga 60 s qolganda yangilanadi; FCM 401 qaytarsa bir marta yangilab qayta uriniladi).
- `sendPush(userIds, {title, body, route, tag}, {senderId?})` va `sendPushToAll(msg, {senderId?})` (device_tokens'ni 1000 tadan sahifalab o'qiydi). Bir vaqtda 20 tagacha so'rov.
- Token faqat FCM `UNREGISTERED` yoki `INVALID_ARGUMENT` deb javob bersa bazadan o'chiriladi. Boshqa xatolar (5xx, 403, tarmoq, "NOT_FOUND" o'zi) tokenni O'CHIRMAYDI — loyiha noto'g'ri sozlansa hamma token yo'qolib ketmasligi uchun.
- **Javobni kutdirmaydi:** triggerlar `runInBackground()` (`@vercel/functions` `waitUntil`) ichida ishlaydi; xato bo'lsa xabar yuborishga ta'sir qilmaydi.
- Hammaga yuboriladigan e'lon (ko'p foydalanuvchi) fon rejimida davom etadi — juda katta auditoriyada Vercel funksiya vaqt chegarasini (`maxDuration`) hisobga oling.

## O'zgargan joylar
- Yangi: `supabase/migration-v25-device-tokens.sql`, `src/lib/push.ts`, `src/lib/push-notify.ts`, `src/app/api/devices/route.ts`
- O'zgargan: `src/app/api/chat/[id]/messages/route.ts` (1:1), `src/app/api/chat/groups/[id]/messages/route.ts` (guruh), `src/app/api/admin/announcements/route.ts` (kanal e'loni), `src/app/api/account/route.ts` (tokenlarni tozalash)

## Sinov natijalari
SQL: 41/41 (atomiklik parallel chaqiruvlar bilan), mutatsiya 16/16. JS: 4 yangi fayl (devices 11, push 37, notify 19, route ulanishlari 17) + akkaunt testi; JS mutatsiya 109 tadan 107 tutildi (2 tasi asosli equivalent). To'liq to'plam 1157/1157, `tsc` toza, 12 migratsiya birga ishlaydi.
