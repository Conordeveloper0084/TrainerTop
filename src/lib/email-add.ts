import { randomInt } from "crypto";

// "Email qo'shish" (Telegram orqali ochilgan akkaunt uchun) — toza yordamchilar.
export const EMAIL_CODE_TTL_SECONDS = 600;     // kod 10 daqiqa amal qiladi (DB funksiyasi ham 600 s)
export const PASSWORD_MIN = 6, PASSWORD_MAX = 72;   // PASSWORD_MIN — ro'yxatdan o'tishdagi qoida (validations.ts) bilan bir xil; 72 — bcrypt chegarasi

// `rand` — faqat testlar uchun (standart: kriptografik tasodifiy)
export const generateEmailCode = (rand: (min: number, max: number) => number = randomInt): string => String(rand(0, 1_000_000)).padStart(6, "0");
export const isValidCode = (v: unknown): v is string => typeof v === "string" && /^\d{6}$/.test(v);

// Oddiy, lekin qat'iy tekshiruv: bitta '@', domenda nuqta, bo'shliqsiz, ≤ 254 belgi
export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e) ? e : null;
}
export const isValidPassword = (v: unknown): v is string => typeof v === "string" && v.length >= PASSWORD_MIN && v.length <= PASSWORD_MAX;

export const emailCodeMessage = (code: string) => ({
  subject: "TrainerTop: emailingizni tasdiqlash kodi",
  text: `Tasdiqlash kodi: ${code}\n\nKod 10 daqiqa amal qiladi. Uni hech kimga aytmang.\nAgar siz TrainerTop akkauntiga email qo'shishni so'ramagan bo'lsangiz, bu xatga e'tibor bermang.`,
});
