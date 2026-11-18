// Ma'lumotlar bazasi funksiyalari (RPC) tashlaydigan xato kodlarini foydalanuvchiga
// tushunarli xabarga aylantiradi. Noma'lum xato — null (chaqiruvchi 500 qaytaradi).

export interface MappedError {
  code: string;
  status: number;
  message: string;
}

const fmt = (n: string | number) => Number(n).toLocaleString("en-US");

export function mapDbError(message: string | undefined | null): MappedError | null {
  const raw = (message || "").trim();
  const m = raw.match(/^([A-Z][A-Z_]+)(?::(.*))?$/);
  if (!m) return null;
  const [, code, arg] = m;

  switch (code) {
    // Pul yechish
    case "BAD_CARD": return { code, status: 400, message: "Karta raqami noto'g'ri. 16 ta raqamni tekshirib, qayta kiriting" };
    case "BAD_HOLDER": return { code, status: 400, message: "Karta egasini lotin harflarida, kartadagidek yozing (masalan: ALI VALIYEV)" };
    case "NOT_TRAINER": return { code, status: 403, message: "Pul yechish faqat trenerlar uchun" };
    case "BANNED": return { code, status: 403, message: "Akkauntingiz cheklangan. Pul yechish hozircha mumkin emas" };
    case "BELOW_MIN": return { code, status: 400, message: `Minimum ${fmt(arg || 100000)} so'm` };
    case "PAYOUT_PENDING": return { code, status: 409, message: "Sizda hali ko'rib chiqilmagan so'rov bor. U hal bo'lgach yangisini yuborishingiz mumkin" };
    case "INSUFFICIENT_FUNDS": return { code, status: 400, message: "Balansda yetarli mablag' yo'q" };
    case "PAYOUT_NOT_FOUND": return { code, status: 404, message: "So'rov topilmadi" };
    case "ALREADY_RESOLVED": return { code, status: 409, message: "Bu so'rov allaqachon ko'rib chiqilgan" };
    case "NOTE_REQUIRED": return { code, status: 400, message: "Rad etish sababini yozing" };
    case "BAD_ACTION": return { code, status: 400, message: "Noto'g'ri amal" };
    // Ban
    case "REASON_REQUIRED": return { code, status: 400, message: "Sabab kamida 5 ta belgidan iborat bo'lishi kerak" };
    case "CANNOT_BAN_SELF": return { code, status: 400, message: "O'zingizni ban qila olmaysiz" };
    case "CANNOT_BAN_ADMIN": return { code, status: 400, message: "Adminni ban qilib bo'lmaydi" };
    case "ALREADY_BANNED": return { code, status: 409, message: "Bu foydalanuvchi allaqachon ban qilingan" };
    case "NOT_BANNED": return { code, status: 409, message: "Bu foydalanuvchi ban qilinmagan" };
    case "USER_NOT_FOUND": return { code, status: 404, message: "Foydalanuvchi topilmadi" };
    case "BAD_UNTIL": return { code, status: 400, message: "Ban muddati noto'g'ri" };
    // Darslik
    case "LESSON_NOT_FOUND": return { code, status: 404, message: "Darslik topilmadi" };
    case "ALREADY_REMOVED": return { code, status: 409, message: "Bu darslik allaqachon o'chirilgan" };
    case "NOT_REMOVED": return { code, status: 409, message: "Bu darslik o'chirilmagan" };
    default: return null;
  }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
