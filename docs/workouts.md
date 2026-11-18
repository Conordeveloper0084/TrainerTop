# Kundalik (mashg'ulot jurnali) — v51

Foydalanuvchi (trener ham) **programma** yaratadi (PPL, Upper/Lower...), uning ichida **kunlar** (Push day...) va mashqlar.
Zalda padxodlarni yozadi, oldingi natijani ko'radi, **yutuqlar** (rekord / vazn oshdi / takror oshdi) oladi, hisobotni PDF qiladi
yoki trenerga **jonli havola** bilan yuboradi. Ma'lumot faqat egasiga (va u ulashgan trenerga) ko'rinadi. Kaloriya — keyinroq.

## Deploy tartibi
1. Supabase SQL Editor: `supabase/migration-v36-workout-log.sql` (agar hali ishga tushmagan bo'lsa) → oxirida `OK` / `73`.
2. Supabase SQL Editor: `supabase/migration-v37-workout-programs.sql` → oxirida `v37: programmalar | OK`.
   Mavjud splitlar avtomatik har foydalanuvchining **"Mening programmam"** programmasiga o'tadi. Qayta ishga tushirish xavfsiz.
3. Keyin website kodi (to'liq ZIP). Kod SQL'dan oldin deploy qilinsa — Kundalik "Server xatolik" beradi (sayt qolgan qismi ishlaydi).

## v50 → v51 o'zgarishlar
| Nima | Avval | Endi |
|---|---|---|
| Tuzilma | Splitlar ro'yxati | **Programma → kunlar → mashqlar**; "Navbatdagi kun" avtomatik (hafta kunlari so'ralmaydi) |
| Mashq qo'shish | Katalogdan qidirish | **O'z so'zi bilan yozish** ("temirda anjimaniya") + o'xshashlar; mushak guruhi ixtiyoriy; katalogga mahalliy nomlar |
| Padxodlar soni | 3 yoki oldingidek | Kun ichida har mashq uchun **1–10** (izolyatsion mashqlarga 1–2) |
| Yozish ekrani | Taymer, yashirin o'chirish | **Taymer yo'q**; `− Padxod` / `+ Padxod`; har padxod yonida jonli belgi (+kg / +takror / Rekord!) |
| Statistika | Hajm (kg), taxminiy 1RM | **Yutuqlar, rekordlar, "boshlaganidan beri +X kg"**, eng og'ir vazn × takror |
| O'chirish | Brauzer `confirm()` | Ilova ichidagi **tasdiq oynasi** (qizil "O'chirish") — hamma joyda |
| Hisobot | — | Programma hisoboti (4 hafta / 3 oy / hammasi), **PDF**, **trenerga jonli havola**, to'xtatish |
| Chat | Havolalar bosilmasdi | **Faqat trainertop.uz havolalari** bosiladi (begonalari — oddiy matn) |

## YUTUQLAR qoidasi (`src/lib/workout.ts` → `classifyOutcome`; Android/iOS AYNAN shunday)
Har mashg'ulotdagi har mashq **oldingi** mashg'ulot (sana bo'yicha, bir kunda — yaratilgan vaqti bo'yicha) bilan solishtiriladi:
1. Avval bajarilmagan → `first` (yutuq emas, solishtirish yo'q).
2. Eng og'ir vazn **hamma vaqtdagi** eng og'irdan katta → `record` (`unit: "kg"`). O'z vazni bilan (0 kg) — eng ko'p takror → `record` (`unit: "reps"`).
3. Oldingi mashg'ulotdan og'irroq → `weight_up` (`delta_kg`).
4. Vazn teng: eng og'ir padxoddagi takror ko'p yoki jami takror ko'p → `reps_up` (`delta_reps`).
5. Kam → `down`, teng → `same` (yutuq emas; jazolanmaydi — faqat mashq statistikasida tasalli matni bilan).
Yutuq = `record | weight_up | reps_up`. **Jonli padxod belgisi** (`setBadge`): o'tgan safargi SHU raqamli padxodga nisbatan (+kg / +takror), eng og'irdan og'ir — "Rekord!".

## API (hammasi login: cookie yoki `Authorization: Bearer`; mehmon → 401 `{message}`)
Xatolar `{ message }` (o'zbekcha). Sana `"YYYY-MM-DD"` (foydalanuvchi sanasi), og'irlik kg, takror butun son.

**Exercise** `{ id, slug|null, name, name_uz|null, aliases|null, muscle_group, equipment, is_bodyweight, is_custom, archived }`
— `muscle_group`: chest, back, shoulders, biceps, triceps, legs, glutes, core, **other**. Kun ichida qo'shimcha: `target_sets` (1–10).
**Split (kun)** `{ id, program_id, name, position, exercises: Exercise[], last_performed_on, sessions_count }`
**Program** `{ id, name, position, days: Split[], sessions_count, sessions_30d, last_performed_on, last_split_id }` — `programs[0]` = asosiy.
**Outcome** `{ exercise_id, type, unit?, value?, previous?, delta_kg?, delta_reps? }`

| Metod | Yo'l | Tana / javob |
|---|---|---|
| GET | `/api/workouts?today=` | `{ programs, recent: SessionSummary[≤5] (+achievements), week: { start, today, days[7], sessions, prev_sessions, achievements, records, streak_weeks }, total_sessions }` |
| POST | `/api/workouts/programs` | `{ name, days?: [{ name, exercises?: [{ exercise_id, target_sets? }] }] }` → 201 `{ program }` (atomar; shablon ham shu) |
| GET / PATCH / DELETE | `/api/workouts/programs/{id}` | PATCH `{ name?, primary?: true }` → `{ program }`; DELETE → `{ ok }` (mashg'ulotlar tarixda qoladi) |
| POST | `/api/workouts/splits` | `{ program_id, name, exercises? }` → 201 `{ split }` |
| GET / PATCH / DELETE | `/api/workouts/splits/{id}` | PATCH `{ name?, exercises?: [{ exercise_id, target_sets }] }` (to'liq ro'yxat, tartibda) |
| GET | `/api/workouts/exercises` | `{ exercises }` (katalog + o'zinikilar) |
| POST | `/api/workouts/exercises` | `{ name, muscle_group?, equipment? }` → 201 yangi / 200 o'zida shu nom bor (o'sha) / 409 `{ message, exercise }` katalogda bor (o'shani ishlating) |
| PATCH / DELETE | `/api/workouts/exercises/{id}` | faqat o'z mashqi; DELETE → `{ result: "deleted" \| "archived" }` |
| GET | `/api/workouts/exercises/{id}/stats` | `{ exercise, pure_bodyweight, sessions_count, records: { max_weight: {value, reps, performed_on}, max_reps: {value, weight_kg, performed_on} }, since_start: { first_date, first_max_weight, last_max_weight, delta_kg, first_max_reps, last_max_reps, delta_reps } \| null, last_outcome: Outcome+{current, previous} \| null, chart: [{performed_on, max_weight, reps_at_top, max_reps}], next_target, history: [... + outcome] }` |
| GET | `/api/workouts/progress` | `{ exercises: [{ exercise, sessions_count, last_date, max_weight, max_reps, first_max_weight, last_max_weight, first_max_reps, last_max_reps }] }` |
| GET | `/api/workouts/previous?exercise_ids=a,b&exclude=&before=` | `{ previous: {id: {session_id, performed_on, sets}}, bests: {id: {max_weight, max_reps, sessions_count, ...}} }` |
| GET | `/api/workouts/sessions?limit=&offset=` | `{ sessions: SessionSummary[] (+achievements), has_more }` |
| POST | `/api/workouts/sessions?today=` | `{ id (klient uuid), split_id?, title?, performed_on, duration_sec?, note?, exercises }` → `{ session (har mashqda outcome), achievements: Outcome[], prs, created }` |
| GET / DELETE | `/api/workouts/sessions/{id}` | `{ session }` (har mashqda `outcome`) / `{ ok }` |
| GET | `/api/workouts/programs/{id}/report?period=4w\|3m\|all&today=` | `{ program, period{key,from,to}, summary{sessions, active_weeks, sets, achievements, records}, days[{id,name,sessions,last_performed_on}], exercises[{exercise, pure_bodyweight, sessions_count, first, last, best, delta_kg, delta_reps, achievements, chart}], recent[] }` |
| GET | `/api/workouts/share-targets` | `{ trainers: [{ id, full_name, avatar_url, conversation_id }] }` — chatdagi trenerlar |
| GET / POST | `/api/workouts/programs/{id}/shares` | GET `{ shares: [{ id, created_at, viewer }] }`; POST `{ viewer_id }` → `{ share: { id, url }, created }` + **chatga xabar** |
| DELETE | `/api/workouts/shares/{id}` | ulashishni to'xtatish (faqat egasi) |
| GET | `/api/workouts/shared/{id}?period=` | trener uchun: `{ owner, is_owner, ...hisobot }`; to'xtatilgan / begona → 404 |

`duration_sec` endi yuborilmaydi (taymer yo'q) — `null`. `prs` — eski mijozlar uchun (faqat rekordlar), yangi kod `achievements` ni o'qisin.

## Trenerga ulashish
- Faqat chatda gaplashgan trenerga (suhbat bo'lishi shart). Chatga oddiy matn xabari: `📊 Mening progress hisobotim: "PPL"\nHar doim eng yangi natijalar shu yerda: https://www.trainertop.uz/workouts/shared/{id}`.
- Havola **jonli**: trener har ochganda eng yangi ma'lumot. Faqat o'sha trener va egasi ochadi (boshqa odam havolani olsa ham — 404).
- Egasi istalgan payt "To'xtatish" → havola darhol ishlamaydi. Qayta yuborilsa — yangi havola.
- Chatda **faqat trainertop.uz** havolalari bosiladi (ilovalar ham: faqat o'z domenimizni linkify qiling).

## PDF
Hisobot sahifasida "PDF yuklash" → brauzerning chop etish oynasi → "PDF sifatida saqlash". Chop etishda faqat hisobot, oq fonda.
Ilovalarda: hisobot sahifasini tizimning Print/Share (PDF) oynasi orqali yoki o'z PDF generatori bilan.

## Testlar (ZIP'ga kirmaydi)
SQL — haqiqiy Postgres'da `ASSERT` (v36 alohida, v36+v37 birga, production'dagi kabi ma'lumot bilan ko'chirish); API — haqiqiy handler'lar haqiqiy Postgres ustida;
UI — jsdom; mutatsiya tekshiruvi; brauzerda mobil (qorong'i/yorug'), PDF.
