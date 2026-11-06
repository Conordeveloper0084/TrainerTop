# Trenerlar / Darsliklar / Postlar sahifalari — ixcham ko'rinish (v40)

Maqsad: mobilda asosiy narsa (trener / darslik / post kartasi) ko'proq joy olsin — iOS va Android ilovalardagi yechim bilan bir xil.

## O'zgarishlar (website)
- **Sarlavha ostidagi kichik matnlar olib tashlandi** ("O'zbekistonning eng yaxshi fitness trenerlari", "Professional darsliklarni sotib oling yoki yarating", "Natijalar, mashqlar va motivatsiya").
- **Sarlavha kattaligi kichraytirildi (FAQAT o'lcham):** Trenerlar, Darsliklar va Postlar sarlavhalari 28 px → 24 px (yangi `text-page-title` tokeni, `tailwind.config.ts`). Shrift (Inter), qalinlik (700) va qator balandligi o'zgarmagan. Umumiy `text-h1` tokeni asl holatida (1.75rem) qoldi, shuning uchun Yordam markazi va boshqa sahifalar oldingidek. *Chat sahifasida veb-versiyada katta sarlavha yo'q (u xabarlashuv oynasi), shuning uchun u yerda o'zgarish yo'q.*
- **Ochiladigan ro'yxatlar (select) o'rniga yonga aylantiriladigan chiplar** (`components/ui/CategoryChips.tsx`): Hammasi, Fitness, Bodybuilding, Yoga, Powerlifting, Dieta, Kardio, CrossFit, Stretching, Pilates, Boks (`SPECIALIZATIONS` dan). Bitta bosish bilan tanlanadi, qayta "Hammasi" bosilsa filtr olinadi.
  - **Trenerlar:** "Yo'nalish" va "Shahar" ro'yxatlari o'rniga yo'nalish chiplari. **Shahar filtri UI'dan olib tashlandi** (trenerlar hozircha kam). API'dagi `city` parametri o'zgarmagan, kerak bo'lsa qaytarish oson.
  - **Darsliklar (Katalog):** "Kategoriya" va "Daraja" ro'yxatlari o'rniga kategoriya chiplari. **"Daraja" (boshlang'ich/o'rta/professional) filtri UI'dan olib tashlandi.** Darsliklarning `difficulty` maydoni va kartadagi belgilar o'zgarmagan.
  - Qidiruv maydoni ikkala sahifada saqlangan va chiplar bilan birga ishlaydi.
- **Postlar:** katta "Post yaratish" tugmasi o'rniga kichik "+ Post" tugmasi (ekran o'qiydiganlar uchun aria-label "Post yaratish"). Post yo'qligidagi bo'sh holatdagi alohida "Post yaratish" tugmasi o'zgarmagan.

## Eslatma
- API va JSON formatlari o'zgarmagan; faqat web UI.
- Qaytarish kerak bo'lsa: olib tashlangan matnlar va select'lar `git`/oldingi ZIP (v39) da bor.
