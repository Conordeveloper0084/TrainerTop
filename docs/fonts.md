# Shrift (Inter) — loyihaning o'zida saqlanadi (v43)

## Nima bo'ldi
v42 deploy'idan keyin sayt **serif (Times)** shriftida chiqdi. Bu oddiy shrift almashishi emas: `body { font-family: var(--font-inter), … }` dagi `--font-inter` o'zgaruvchisi aniqlanmasa, butun deklaratsiya yaroqsiz bo'lib, brauzer standart serif'ga tushadi. Eski sozlamada bu o'zgaruvchi Google'dan yuklanadigan shrift (`next/font/google`) orqali, `<html>` ning maxsus class'i bilan beriladi edi.

**Aniq sababi tasdiqlanmadi:** v39 va v42 kodidan shrift qismi bo'yicha farq yo'q (v39→v42 farqida layout/shrift fayllari yo'q), ikkala build ham aynan bir xil `--font-inter` ta'rifi va `<html class>` beradi. Shuning uchun sabab deploy/build yoki brauzer holatida bo'lgan ko'rinadi. O'rniga shu turdagi nosozlikning o'zini yo'q qildik.

## Nima o'zgardi
- **Shrift endi loyihaning o'zida:** `public/fonts/` (Inter variable, 4 fayl, SIL OFL litsenziya). `globals.css` da `@font-face` (unicode-range bilan: brauzer faqat kerakli fayl(lar)ni yuklaydi) va `:root { --font-inter: … }`. Build vaqtida ham, ishlashda ham Google Fonts'ga bog'liqlik YO'Q.
- `<html>` dagi shrift class'i kerak emas (o'zgaruvchi `:root` da), `next/font` olib tashlandi.
- **Zaxira:** `body` va Tailwind `font-sans` da `var(--font-inter, "Inter", system-ui, sans-serif)` — o'zgaruvchi qandaydir sabab bilan topilmasa ham hech qachon serif'ga tushmaydi. Yuklanguncha `Inter Fallback` (Arial'ga moslashtirilgan, matn sakramasin).
- Lotin shrifti `<link rel="preload">` bilan oldindan yuklanadi.
- **Middleware matcher'ga `fonts/` qo'shildi:** middleware har so'rovda Supabase Auth'ga tarmoq chaqiruvi qiladi; busiz shrift fayllari har safar shuni kutardi (eski `_next/static` shrifti buning ta'siridan ozod edi).

## Tekshirilgan
- O'zbek lotin (`oʻ`, `gʻ` = U+02BB, U+02BC, `‘ ’`) va kirill (`ў қ ғ ҳ №`) harflari tegishli fayllarda bor (fontTools bilan glif darajasida, unicode-range bilan solishtirilgan); `wght` o'qi 100–900.
- Build Google'ga umuman bog'lanmasdan o'tadi; natijaviy CSS'da to'rtala `@font-face`, `:root` da `--font-inter`, HTML'da `<html lang="uz">` va preload bor.
- **TekshirilMAGAN:** brauzerda ko'zga ko'rinish (sandbox'da brauzer yo'q). Inter — avvalgi Google shrifti bilan bir xil garnitura (Inter 4, variable), lekin yonma-yon solishtirish qilinmagan.

## Deploy'dan keyin (1 daqiqa)
1. Saytni **Incognito** oynada oching (brauzer keshi/service worker ta'sirisiz).
2. F12 → Elements → `<body>` ni tanlang → Computed → `font-family` boshida `Inter`. Network → Font bo'limida `inter-latin-wght-normal.woff2` `200` bilan yuklanishi kerak.
3. Oddiy oynada eski ko'rinish qolsa: F12 → Application → Service Workers → Unregister va Storage → Clear site data (PWA service worker statik fayllarni keshlaydi).

## Orqaga qaytarish
Eski holat: v39/v42 ZIP'idagi `layout.tsx`, `globals.css`, `tailwind.config.ts`, `middleware.ts`. `public/fonts/` zararsiz qoladi.
