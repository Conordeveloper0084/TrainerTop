// Xususiyat "flag"lari. NEXT_PUBLIC_* qiymatlari build paytida kodga joylanadi —
// o'zgartirgach Vercel'da Redeploy qilish kerak.

// Google tugmasi faqat Supabase'da Google provider sozlangach ko'rsatiladi
// (aks holda tugma bosilganda foydalanuvchi xom xato sahifasiga tushadi).
export const GOOGLE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true";
