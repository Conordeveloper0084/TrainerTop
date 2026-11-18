// Telefon raqam yordamchilari — sof funksiyalar (brauzerga ham xavfsiz; server kutubxonalariga bog'liq emas).

// Telefon → E.164 (DB CHECK bilan bir xil): "+" va 7–15 raqam, birinchi raqam 0 emas. O'zbekiston (+998) uchun aniq 9 ta abonent raqami.
// Telegram kontakti "998901234567" yoki "+998 90 123-45-67" ko'rinishida kelishi mumkin.
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15 || digits.startsWith("0")) return null;
  if (digits.startsWith("998") && digits.length !== 12) return null;
  return `+${digits}`;
}

// Raqamni boshqalarga ko'rsatish MUMKIN EMAS — faqat maska (egasiga ham, botda ham): "+998 •• ••• •• 67". Boshqa mamlakatlar: oxirgi 2 raqam.
export function maskPhone(phone: string | null | undefined): string | null {
  if (typeof phone !== "string" || !/^\+[1-9][0-9]{6,14}$/.test(phone)) return null;
  if (/^\+998[0-9]{9}$/.test(phone)) return `+998 •• ••• •• ${phone.slice(-2)}`;
  return `+${"•".repeat(phone.length - 3)}${phone.slice(-2)}`;
}
