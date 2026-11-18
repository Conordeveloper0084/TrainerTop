// Telegram orqali kirgan foydalanuvchilarning SINTETIK emaili (Supabase Auth email talab qiladi).
// Bu modul toza (Node'ning `crypto`ida bog'liq emas) — brauzer komponentlari ham import qila oladi.
// Domen DOIMIY (env emas): brauzerda env o'qilmaydi, server va sayt mos kelmay qolmasligi uchun.
export const SYNTHETIC_EMAIL_DOMAIN = "users.trainertop.uz";

export const syntheticEmail = (telegramId: number | string) => `tg${telegramId}@${SYNTHETIC_EMAIL_DOMAIN}`;
export const tombstoneEmail = (userId: string) => `deleted-${userId}@${SYNTHETIC_EMAIL_DOMAIN}`;
export function isSyntheticEmail(email: unknown): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith("@" + SYNTHETIC_EMAIL_DOMAIN);
}
// Foydalanuvchiga ko'rsatiladigan email: sintetik bo'lsa null (UI "Telegram orqali kirgan" deb ko'rsatadi)
export const displayEmail = (email: unknown): string | null => (typeof email === "string" && email && !isSyntheticEmail(email) ? email : null);
