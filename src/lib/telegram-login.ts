import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

// "Telegram orqali kirish" — toza (DB/tarmoqsiz) yordamchilar. Oqim va xavfsizlik: docs/telegram-login.md

export const LOGIN_TTL_SECONDS = 300;           // so'rov muddati — 5 daqiqa (DB ham 300 s dan foydalanadi)
export const POLL_INTERVAL_MS = 2000;           // mijozlar uchun tavsiya
export type LoginPlatform = "android" | "ios" | "web";
export const PLATFORMS: readonly LoginPlatform[] = ["android", "ios", "web"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidLoginId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
// poll_secret = 32 tasodifiy bayt, base64url → aynan 43 belgi
export const isValidPollSecret = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v);

export function getTelegramConfig() {
  return {
    token: process.env.TELEGRAM_LOGIN_BOT_TOKEN || "",
    botUsername: (process.env.TELEGRAM_LOGIN_BOT_USERNAME || "").replace(/^@/, ""),
    webhookSecret: process.env.TELEGRAM_LOGIN_WEBHOOK_SECRET || "",
  };
}

// Bazada faqat hash saqlanadi (poll_secret yuqori entropiyali tasodifiy qiymat — tuzsiz SHA-256 yetarli)
export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");
export const newPollSecret = () => randomBytes(32).toString("base64url");

// Doimiy vaqtli taqqoslash (webhook secret_token uchun)
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ha = createHash("sha256").update(a).digest(), hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function buildLinks(botUsername: string, loginId: string) {
  const payload = `login_${loginId}`;
  return { bot_url: `https://t.me/${botUsername}?start=${payload}`, tg_url: `tg://resolve?domain=${botUsername}&start=${payload}` };
}

// Tezlik limiti kalitlari: xom IP/qurilma id saqlanmaydi — kalitli hash (bot tokeni kalit)
const keyed = (v: string) => createHmac("sha256", getTelegramConfig().token || "no-token").update(v).digest("hex");
export function clientIpKey(headers: { get(name: string): string | null }): string {
  const xff = headers.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0] : headers.get("x-real-ip") || "unknown").trim() || "unknown";
  return keyed("ip:" + ip);
}
export function deviceKey(deviceId: unknown): string | null {
  return typeof deviceId === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(deviceId) ? keyed("dev:" + deviceId) : null;
}

// Telefon: "+" va 7–15 raqam (DB CHECK bilan bir xil)
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : null;
}

// Sintetik email yordamchilari — src/lib/synthetic-email.ts (brauzerga ham xavfsiz); shu yerdan ham eksport qilinadi
export { SYNTHETIC_EMAIL_DOMAIN, syntheticEmail, tombstoneEmail, isSyntheticEmail, displayEmail } from "@/lib/synthetic-email";

export function fullNameFrom(t: { first_name?: string; last_name?: string; username?: string }): string {
  const name = [t.first_name, t.last_name].filter((x) => typeof x === "string" && x.trim()).join(" ").trim();
  return (name || t.username || "Foydalanuvchi").slice(0, 80);
}

// Username (DB qoidasi: ^[A-Za-z0-9_]{3,20}$) — Telegram username bo'yicha nomzodlar: asl, keyin raqam qo'shib
export function usernameCandidates(tgUsername: string | undefined | null, count = 6): string[] {
  const base = (tgUsername || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 20);
  if (base.length < 3) return [];
  const out = [base];
  for (let i = 2; out.length < count; i++) {
    const suffix = String(i);
    out.push(base.slice(0, 20 - suffix.length) + suffix);
  }
  return out;
}

export const PLATFORM_LABEL: Record<LoginPlatform, string> = { android: "Android", ios: "iOS", web: "veb-sayt" };
// Tasdiq matni — aniq (talab qilingan): faqat /start emas, TUGMA bosilishi shart
export const confirmText = (platform: LoginPlatform) => `Siz hozir TrainerTop'ga (${PLATFORM_LABEL[platform] ?? platform}) kiryapsiz. Agar bu siz bo'lmasangiz, bosmang.`;

export const BAN_MESSAGE = "Akkauntingiz bloklangan. Batafsil ma'lumot uchun support botiga yozing: @TrainerTop_Support_Bot";
