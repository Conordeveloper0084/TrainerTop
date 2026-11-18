VAZIFA (Android va iOS uchun): "Kundalik" — mashg'ulot jurnali, website v51 dagi bilan bir xil. Server API tayyor: docs/workouts.md
(maydon nomlari, YUTUQLAR qoidasi, ulashish). AYNAN shu formatlar va qoidalarni ishlating, API'ni o'zgartirmang.

1) MENYU: pastda Topish · Postlar · Kundalik · Chat · Profil. "Topish" ichida tepada Trenerlar | Darsliklar tablari.
   Mehmon "Kundalik"ni ochsa — 4 ta afzallik + "Kirish va boshlash".

2) BOSH EKRAN — GET /api/workouts?today=<telefon sanasi>
   - Tugallanmagan mashg'ulot kartasi (qoralama bo'lsa).
   - "Bu hafta": Du…Ya doirachalar, 3 katak: Mashg'ulotlar (o'tgan hafta N) · Yutuqlar · Rekordlar 🏆. KG/HAJM KO'RSATILMAYDI. Streak.
   - "Programmalarim": programs[0] — asosiy: "Navbatdagi: <kun>" + katta Boshlash (nextDay: last_split_id dan keyingisi, aylanma),
     qolgan kunlar ixcham + Boshlash. Boshqa programmalar — ixcham kartalar. Bo'sh holat: 3 shablon (PPL, Upper/Lower, Full body —
     slug'lar src/lib/workout.ts PROGRAM_TEMPLATES) + "O'zim yarataman". "Programmasiz boshlash".
   - Oxirgi mashg'ulotlar (yutuqlar soni bilan).

3) PROGRAMMA: statistika (jami, 30 kun, oxirgi), navbatdagi kun, kunlar (Boshlash/tahrirlash), "+ Kun qo'shish", "Hisobot", nomini
   o'zgartirish, "Asosiy qilish", o'chirish. Yangi programma: nom + kun nomlari (taklif chiplari).

4) KUN TAHRIRI: nom; mashqlar tartibi (↑↓), har mashq yonida padxodlar soni [−] N [+] (1–10); olib tashlash — TASDIQ bilan.

5) MASHQ QO'SHISH: tepada "Mashq nomi" — odam O'Z SO'ZI bilan yozadi ("temirda anjimaniya"). Yozayotganda o'xshashlari (name, name_uz,
   aliases bo'yicha; apostrofsiz, katta-kichik harf farqsiz). Ro'yxatda aynan shu nom bo'lmasa — '"…" deb qo'shish' (POST /exercises {name};
   200 — o'zida bor, 409 — katalogdagi exercise qaytadi, o'shani tanlang). Bo'sh bo'lsa — mushak guruhi chiplari bilan butun ro'yxat.

6) MASHG'ULOT YOZISH: TAYMER YO'Q. Padxodlar soni — kundagi target_sets. "Oldingi (sana): 100 kg × 12 · 10 · 7", "Maqsad: …".
   Qator: # · kg · takror · ✓; bo'sh maydonda o'tgan safargi qiymat (o'qiladigan kontrastda). ✓ yoki biror qiymat yozilgan qator saqlanadi.
   Har qator ostida jonli belgi (setBadge): "+2.5 kg" / "+1 takror" / "🏆 Rekord!". Pastda `− Padxod` (ma'lumotli qatorda — tasdiq) va `+ Padxod`.
   Mashqni olib tashlash, bekor qilish — TASDIQ bilan. Qoralama telefonda; id boshlanganda yaratiladi; internet yo'q — saqlab, qaytganda
   O'SHA id bilan yuborish. duration_sec: null.
   Natija: "Zo'r! O'sish bor" / "Mashg'ulot saqlandi!", 3 katak: Mashqlar · Padxodlar · Yutuqlar, ro'yxat (outcomeText).

7) TARIX / TAFSILOT: qatorda "N yutuq"; tafsilotda har mashq yonida faqat yutuq belgisi (pastroq — ko'rsatilmaydi). Tahrirlash, o'chirish (tasdiq).

8) MASHQ STATISTIKASI: "Boshlaganingizdan beri: 95 kg → 105 kg +10 kg", oxirgi natija kartasi (Kuchingiz oshdi / Yangi rekord! /
   O'zgarmadi / Bu safar biroz pastroq + tasalli), maqsad, Eng og'ir vazn (× takror), Eng ko'p takror, grafik Vazn | Takror, tarix belgilari.
   1RM va hajm YO'Q. Progress ro'yxatida: eng og'ir vazn + "boshlaganidan beri" o'zgarish.

9) HISOBOT: davr (4 hafta / 3 oy / hammasi), xulosa (mashg'ulotlar, faol haftalar, yutuqlar, rekordlar), kunlar, mashqlar
   ("95 kg → 105 kg +10 kg", eng og'ir, grafik — qiymat o'zgarmagan bo'lsa grafik yo'q), oxirgi mashg'ulotlar.
   "PDF" (tizim Print/Share oynasi), "Trenerga yuborish": GET /share-targets → tanlash → tasdiq → POST shares (chatga havola ketadi).
   "Ko'ra oladi: <trener> · To'xtatish" (tasdiq). Ulashilgan havola (/workouts/shared/{id}) ilovada ham ochilsin (deep link) — trener ko'radi.

10) CHAT: xabar matnidagi FAQAT trainertop.uz havolalari bosiladi (ilovada — /workouts/shared/{id} ni ilova ichida ochish).

11) TASDIQ OYNASI: barcha o'chirishlarda ilova uslubidagi oyna, qizil "O'chirish" + "Bekor".

TOPSHIRISH: nima qilindi; tekshirish: yangi programma (shablon) → Navbatdagi kun → padxod soni 1 bo'lgan mashq 1 qator ochiladi →
o'z nomi bilan mashq qo'shish → oldingidan ko'p takror — "+1 takror" belgisi → natijada yutuqlar → hafta kartasida Yutuqlar/Rekordlar →
hisobot trenerga → trener akkauntida havola ochiladi, yangi mashg'ulot yozilganda trenerda ham yangilanadi → To'xtatish → havola yopiladi;
website bilan bir xil raqamlar.
