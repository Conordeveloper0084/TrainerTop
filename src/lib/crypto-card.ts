// Trener pul yechish kartasini shifrlash — AES-256-GCM, ILOVA DARAJASIDA (Node.js crypto).
// Xom karta raqami bazaga HECH QACHON yozilmaydi — faqat shu yerda shifrlangan natija.
// Kalit: PAYOUT_CARD_KEY muhit o'zgaruvchisi — 64 ta hex belgi (32 bayt, AES-256 uchun shart).
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;     // GCM uchun tavsiya etilgan uzunlik
const KEY_HEX_LEN = 64; // 32 bayt = 64 ta hex belgi

export class PayoutCardKeyError extends Error {
  constructor() { super("PAYOUT_CARD_KEY noto'g'ri sozlangan (64 ta hex belgi — 32 baytlik AES-256 kalit bo'lishi kerak)"); this.name = "PayoutCardKeyError"; }
}

function getKey(): Buffer {
  const raw = (process.env.PAYOUT_CARD_KEY || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) throw new PayoutCardKeyError();
  return Buffer.from(raw, "hex");
}

// Faqat kalit TO'G'RI sozlanganini tekshiradi (shifrlashga urinmasdan) — endpoint boshida
// aniq 500 xato qaytarish uchun, shifrlashda kutilmagan istisno sifatida emas.
export function isPayoutCardKeyConfigured(): boolean {
  try { getKey(); return true; } catch { return false; }
}

// "8600 1234 5678 9012" yoki "8600123456789012" → shifrlangan matn (iv:tag:ciphertext, hammasi base64).
export function encryptCardNumber(digitsOnlyCard: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(digitsOnlyCard, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

// Shifrlangan matndan xom karta raqamini qaytaradi. Faqat admin (to'lovni amalga oshirish uchun,
// so'rov "pending" bo'lganda) yoki pul yechish so'rovini yaratayotgan trenerning o'zi (use_saved_card)
// uchun chaqiriladi — natija HECH QACHON API javobida to'liq holda qaytarilmaydi.
export function decryptCardNumber(encoded: string): string {
  const key = getKey();
  const parts = encoded.split(":");
  if (parts.length !== 3) throw new Error("Shifrlangan karta formati noto'g'ri");
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return dec.toString("utf8");
}
