# Darslik ko'rish sahifasi — YouTube uslubidagi joylashuv

## Nima tuzatildi
1. **Video skroll bilan siljib ketishi**: sabab — "Modullar" (video ro'yxati) ilgari videoning O'ZI bilan BIR XIL ustunda, uning OSTIDA joylashgan edi. Ro'yxatdan 3-videoni tanlash uchun pastga skroll qilganingizda, bu video ham o'sha bitta ustun ichida pastga "siljib" ketardi.
2. **Video juda tor joyda edi**: sahifa `container-main` (butun saytdagi kabi, kengroq) ustiga qo'shimcha `max-w-4xl` (taxminan 896px) cheklovi qo'yilgan edi — shuning uchun video navbar/boshqa sahifalar bilan bir xil chekka chizig'ida emas, sun'iy ravishda torroq ko'rinardi.

## Yangi joylashuv (desktop, ≥1024px)
YouTube'dagi kabi: **chap tomonda katta video** (ustunning 8/12 qismi) + ostida izoh/savol-javob/sharhlar; **o'ng tomonda modullar va video ro'yxati** (4/12 qism) — bu ro'yxat endi videoning alohida, **mustaqil** panelida, DOIMIY (sticky) holda turadi. Boshqa videoni tanlash uchun endi sahifani video ustidan skroll qilish shart emas — ro'yxat video bilan yonma-yon, o'zi mustaqil aylanadi.

`max-w-4xl` olib tashlandi — video endi butun sahifa kengligida (navbar bilan bir xil chekka chiziqda).

## Mobil (ekran torroq, <1024px)
Bitta ustunda, lekin tartib o'ylab joylashtirilgan: **1) Video + Oldingi/Keyingi + shu videoga savol → 2) Modullar/video ro'yxati (boshqa videoni tez tanlash uchun) → 3) Darslik ma'lumoti, umumiy savollar, sharhlar**. Avvalgi "avtomatik skroll" xatti-harakati (video tanlansa pleerga silliq o'tish) saqlanib qoldi.

## O'zgargan fayl
`src/app/(main)/lessons/[id]/page.tsx` — faqat joylashuv (CSS grid/tartib), hech qanday backend yoki ma'lumot mantig'i o'zgarmadi (avvalgi "Video darsliklar" va video-bo'yicha savol-javob funksiyalari bilan bir xil ishlaydi).

## Sinov
`tsc` toza, production build muvaffaqiyatli. Bu — sof joylashuv (CSS/JSX tuzilish) o'zgarishi bo'lgani uchun, mavjud backend testlari (xaridlar filtri, video-bo'yicha savol API) o'zgarishsiz qoldi va baribir amal qiladi.
