# Tezlik (ZIP-4)

## Server mintaqasi (kod emas, Vercel sozlamasi)
Supabase Singapur (ap-southeast-1) da. Vercel funksiyalari ham Singapur (sin1) da bo'lishi kerak:
Vercel → Settings → Functions → Function Region → Singapore, keyin Redeploy. Funksiya va baza bir joyda bo'lsa, API ichidagi har bir DB so'rovi ~200+ ms o'rniga bir necha ms oladi.

## Fon so'rovlari (polling)
- `lib/shared-poll.ts`: bitta umumiy poller. Navbar (3 nusxa) va MobileBottomNav necha marta chizilmasin, tarmoqqa bitta so'rov ketadi.
- Chat nishoni: `/api/chat/unread` (faqat son) — 30 soniyada bir. Avval har 15 soniyada butun `/api/chat` ro'yxati ikki marta yuklanardi.
- Bildirishnomalar: 60 soniyada bir. Tab yashirin bo'lsa so'rov yuborilmaydi, qaytganda darhol yangilanadi.
- Chat ochilganda nishon darhol yangilanadi.

## Sahifalar
- Darsliklar: katalog va platforma so'rovlari parallel; "o'z darsliklarim" alohida va auth yuklangach so'raladi (sahifa yangilanganda ham ishlaydi).
- Postlar: har post "view" so'rovi brauzer sessiyasida bir marta; `/api/posts` ichida bog'liq bo'lmagan so'rovlar parallel, layklar faqat ko'rsatilayotgan postlar uchun.

## Ataylab qilinmagan
- Middleware'ni cheklash (`getUser()` ni har o'tishda chaqirmaslik): o'lchovda o'tishning o'zi tez (~240 ms), sessiya yangilanishini buzish xavfi foydadan katta.
- Ochiq ro'yxatlarni CDN'da keshlash: trener yangi darslikni e'lon qilsa 30 soniya ko'rinmay qolishi mumkin. Foydalanuvchilar ko'payganda qaytamiz.
