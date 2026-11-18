import { createHash } from "crypto";

import { SUPPORT_LIMITS, SUPPORT_SUBJECTS } from "@/lib/support-constants";
export { SUPPORT_LIMITS, SUPPORT_SUBJECTS };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type SupportInput = { name: string; email: string; subject: string | null; message: string };
export type SupportValidation = { ok: true; value: SupportInput } | { ok: false; spam?: boolean; message: string };

// `website` — botlar to'ldiradigan yashirin maydon (odam ko'rmaydi). To'lgan bo'lsa jimgina qabul qilingandek tutamiz.
export function validateSupportInput(body: any): SupportValidation {
  const b = body && typeof body === "object" ? body : {};
  if (typeof b.website === "string" && b.website.trim() !== "") return { ok: false, spam: true, message: "spam" };

  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const message = typeof b.message === "string" ? b.message.trim() : "";
  const rawSubject = typeof b.subject === "string" ? b.subject.trim() : "";
  const subject = rawSubject ? (SUPPORT_SUBJECTS[rawSubject] || rawSubject).slice(0, SUPPORT_LIMITS.SUBJECT_MAX) : null;

  if (!name || name.length > SUPPORT_LIMITS.NAME_MAX) return { ok: false, message: "Ismingizni kiriting" };
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, message: "Email manzili noto'g'ri" };
  if (message.length < SUPPORT_LIMITS.MESSAGE_MIN) return { ok: false, message: `Xabar kamida ${SUPPORT_LIMITS.MESSAGE_MIN} belgi bo'lsin` };
  if (message.length > SUPPORT_LIMITS.MESSAGE_MAX) return { ok: false, message: `Xabar juda uzun (maksimum ${SUPPORT_LIMITS.MESSAGE_MAX} belgi)` };
  return { ok: true, value: { name, email, subject, message } };
}

// IP manzil xom holda saqlanmaydi — faqat cheklov uchun qaytarilmas belgi
export function hashIp(ip: string): string {
  return createHash("sha256").update("tt-support:" + ip).digest("hex").slice(0, 32);
}
export function clientIp(request: Request): string | null {
  const xf = request.headers.get("x-forwarded-for");
  const ip = (xf ? xf.split(",")[0] : request.headers.get("x-real-ip") || "").trim();
  return ip || null;
}
