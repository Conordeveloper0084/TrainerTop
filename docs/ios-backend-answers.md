# iOS savollariga backend javoblari (v42)

Hammasi KODNI o'qib yozildi (kod yo'li ko'rsatilgan). Jonli qurilmada sinalmagan joylar belgilangan.

---
## 1) Suhbatni "o'zim uchun o'chirish" — **QILINDI (v42)**
Avval API yo'q edi (faqat bitta xabarni o'chirish: `DELETE /api/chat/messages/{id}`). Endi bor.

```
DELETE /api/chat/{conversationId}
Authorization: Bearer <token>        // yoki cookie
```
| Holat | Status | Tana |
|---|---|---|
| Muvaffaqiyat (qayta chaqirish ham) | **200** | `{"success":true}` |
| Login yo'q | 401 | `{"message":"Login kerak"}` |
| Suhbat yo'q / sizniki emas / id UUID emas | 404 | `{"message":"Suhbat topilmadi"}` |
| Server/baza xatosi | 500 | `{"message":"Server xatolik"}` |

**Xatti-harakat (kafolatlar):**
- **Faqat o'zim uchun.** Suhbatdoshda hech narsa o'zgarmaydi. Ikkala ishtirokchi (trener ham, foydalanuvchi ham) o'z tomonidan o'chira oladi.
- **`GET /api/chat`:** o'chirilgan suhbat ro'yxatda **yo'q**. U **o'chirilgandan keyin yangi xabar kelsa (yoki men yozsam)** ro'yxatga qaytadi; qaytganda `last_message` — o'sha yangi xabar. Maydonlar/format o'zgarmagan.
- **`GET /api/chat/{id}/messages`:** faqat **o'chirilgan paytdan keyingi** xabarlar qaytadi (`before`/`limit` sahifalash avvalgidek ishlaydi). Eski xabarlar qaytmaydi — suhbat qaytib kelganda ham.
- Mening tomondagi o'qilmaganlar soni (`my_unread`) o'chirilganda **0** ga tushadi.
- `POST /api/chat {trainer_id}` o'sha suhbat id'sini qaytaraveradi (suhbat o'chmaydi, faqat men uchun yashiriladi).
- Idempotent: qayta chaqirsangiz o'chirish vaqti yangilanadi.

**iOS uchun muhim:**
- **Lokal keshni ham tozalang.** iOS suhbat ichini lokal saqlaydi (hisobotingizga ko'ra) — o'chirishda shu suhbat keshini o'chiring, aks holda suhbat qaytganda eski xabarlar keshdan chiqib qoladi.
- Push yoki yangilanish bilan yangi xabar kelsa, suhbat ro'yxatda qayta paydo bo'lishi **kutilgan** holat (xato emas).
- Guruh suhbatlari uchun bu API emas (guruhdan chiqish: `POST /api/chat/groups/{id}/leave`, mavjud).

**Chegaralar:** bu API darajasidagi yashirish — `messages` jadvalidagi qatorlar o'chmaydi. Supabase'ga to'g'ridan-to'g'ri (REST/Realtime) ulanadigan mijoz eski xabarlarni ko'ra oladi; shuning uchun xabar ro'yxatini faqat API orqali oling. (O'chirilgan paytni boshqa ishtirokchi o'zgartira olmasligi uchun belgi alohida, faqat server yoza oladigan jadvalda saqlanadi — `migration-v31`.)
**Deploy tartibi:** avval `migration-v31-conversation-clears.sql`, keyin kod. Kod SQL'dan oldin chiqsa ham chat o'qish buzilmaydi (log'ga yoziladi), faqat `DELETE` 500 beradi.

---
## 2) Video savollarini guruhga aks ettirish — **QILINDI (v44)**
Qaror: ha. Aniq format, route'lar va qoidalar — `docs/app-answers-v44.md` §3 da (yangi route yo'q; server `POST …/questions` va birinchi `PATCH …/questions/{id}` javobida o'zi guruhga yozadi; xabarlarda `video_title`, `lesson_question_id`, `lesson_question_kind`). Quyidagi dastlabki taklifdan farq: uchinchi maydon `lesson_question_kind` ('question'|'answer') qo'shildi, javob xabarida ham "📹 …" qatori bor.

---
## 3) E'lonlarni iOS'dan yashirish (`hide_on_ios`) — **MUMKIN, lekin bitta maydondan ko'proq ish; qaror kerak**
Nima qilinishi kerak (shu hammasi bo'lmasa maydon yetarli emas):
1. `announcements.hide_on_ios boolean default false` + admin e'lon yaratish/tahrirlash oynasida katakcha (admin faqat website'da).
2. **Server iOS'ni qanday biladi:** iOS har so'rovda `X-Client-Platform: ios` header'ini yuborsin (taklif; soxtalashtirish mumkin — bu xavfsizlik emas, ko'rsatishni boshqarish). Header yo'q — oddiy mijoz.
3. `GET /api/announcements` (ro'yxat) **va** `GET /api/announcements/summary` (o'qilmaganlar soni va oxirgi e'lon) iOS'ga belgilangan e'lonlarni **bermasin** — bular SQL funksiyalari (`announcement_feed`, `announcement_summary`) orqali ishlaydi, ularni almashtirish kerak. Faqat ro'yxatni filtrlasak, o'qilmaganlar belgisi yashirin e'lonni sanayverardi.
4. **Push:** hozir kanal e'loni `sendPushToAll` bilan hamma qurilmaga ketadi — yashirilgan e'lon iOS qurilmalarga (`device_tokens.platform='ios'`) **yuborilmasligi** kerak, aks holda sotuvga yo'naltiruvchi matn bildirishnomada chiqadi.
5. **Darslikni "boost" qilgan e'lonlar** (`lesson_id` bor — darslik kartochkasi) mohiyatan sotuv. Ularni iOS'dan avtomatik yashirish (katakchasiz) tavsiya etiladi — qaror kerak.
6. Soddaroq muqobil: faqat `hide_on_ios` maydonini ro'yxat javobiga qo'shish va iOS o'zi filtrlashi — lekin 3–4-bandlar (badge, push) baribir iOS'ga yetib boradi, shuning uchun tavsiya etmayman.

**Eslatma (yuridik maslahat emas):** App Store qoidalari raqamli kontent sotuvini butun ilova bo'ylab (xarid oqimi ham) baholaydi; faqat e'lonlarni yashirish yetarli bo'lmasligi mumkin. Buni Apple App Review qoidalari bo'yicha alohida tekshiring.
**Hajm:** katta emas, lekin SQL funksiyalarini almashtirish va 4 joyga tegish — ehtiyotkor ish (testlar bilan). **Qaror kerak:** header nomi, boost e'lonlari, mavjud e'lonlar (standart: hammasi ko'rinadi).

---
## 4) Darslik videosida `duration` / `thumbnail_url` — **HOZIR YO'Q**
`content.sections[].videos[]` elementi aynan shunday: `{ "title": "...", "description": "...", "url": "..." }`, boshqa maydon yo'q (kod: `app/(main)/lessons/create/page.tsx` saqlaydi, `POST/PUT /api/lessons` JSON'ni o'zgartirmay saqlaydi). Darslikning faqat `cover_image_url` muqovasi bor.

**iOS hozir server o'zgarishisiz qila oladi:**
- **YouTube havolalari:** thumbnail'ni havoladan hosil qilish: video id (`youtu.be/<id>`, `watch?v=<id>`) → `https://img.youtube.com/vi/<id>/hqdefault.jpg`. Davomiylikni YouTube'dan olib bo'lmaydi (API kalit kerak).
- **Yuklangan (R2) videolar:** davomiylikni qurilmada `AVURLAsset(url:).duration` bilan olish (asinxron, ro'yxat ko'rinishida kerak bo'lganda yuklanadi).

**Serverga qo'shish mumkin** (ixtiyoriy maydonlar, eski darsliklar o'zgarmaydi): har video uchun `duration` (butun soniya) va `thumbnail_url`. Veb'dagi darslik yaratish sahifasi yuklash paytida ularni brauzerda aniqlaydi (post videolari uchun shu kod bor: `getVideoMeta`, `captureVideoPoster`, `uploadPoster` — `lib/upload.ts`). **Cheklov:** mavjud darsliklarga avtomatik qo'yib bo'lmaydi (serverda `ffprobe` yo'q) — faqat yangi yuklashlarga; shuning uchun iOS maydon yo'q bo'lgan holatni (yuqoridagi zaxira yo'llar bilan) qo'llashi shart. Android/iOS'da darslik yuklash bo'lsa, ular ham shu maydonlarni yuborishi kerak.
**Qaror kerak:** serverga qo'shilsinmi yoki iOS qurilmada hal qilinadimi.
