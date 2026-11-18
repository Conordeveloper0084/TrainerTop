import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "crypto";

// Qisqa muddatli sirlarni (masalan email qo'shishda tasdiqlash kutilayotgan parol) bazada ochiq saqlamaslik uchun:
// AES-256-GCM, ILOVA DARAJASIDA. Kalit — PAYOUT_CARD_KEY (64 hex belgi, allaqachon sozlangan) dan HKDF bilan, alohida "info"
// satri bilan hosil qilingan SUBKALIT (karta shifrlash kaliti bilan bevosita bir xil emas).
export class SecretBoxKeyError extends Error { constructor() { super("PAYOUT_CARD_KEY sozlanmagan yoki noto'g'ri (64 hex belgi)"); this.name = "SecretBoxKeyError"; } }

function master(): Buffer {
  const raw = (process.env.PAYOUT_CARD_KEY || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) throw new SecretBoxKeyError();
  return Buffer.from(raw, "hex");
}
const sub = (info: string) => Buffer.from(hkdfSync("sha256", master(), Buffer.alloc(0), info, 32));

export function isSecretBoxConfigured(): boolean { try { master(); return true; } catch { return false; } }

export function sealSecret(plain: string): string {
  const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", sub("trainertop/secret-box/v1"), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}
export function openSecret(sealed: string): string {
  const [iv, tag, enc] = sealed.split(":"); if (!iv || !tag || !enc) throw new Error("secret-box: format noto'g'ri");
  const d = createDecipheriv("aes-256-gcm", sub("trainertop/secret-box/v1"), Buffer.from(iv, "base64")); d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
}
// Kod hash'i: HMAC(subkalit, foydalanuvchi:email:kod) — kodni foydalanuvchi va emailga bog'laydi; bazada kodning o'zi yo'q
export const hmacCode = (userId: string, email: string, code: string) => createHmac("sha256", sub("trainertop/email-code/v1")).update(`${userId}:${email}:${code}`).digest("hex");
