// Admin'ga pul yechish so'rovini ko'rsatishda karta qanday chiqishini belgilaydi — ikkala joyda
// (ro'yxat va bitta so'rovni hal qilish javobi) bir xil qoidaga rioya qilinishi uchun umumiy.
import { decryptCardNumber } from "@/lib/crypto-card";
import { maskCard, digitsOnly } from "@/lib/card";

// "pending" bo'lsa TO'LIQ raqam (o'tkazishni amalga oshirish uchun kerak); "completed"/"rejected"'dan
// keyin MASKALANGAN ("•••• 1234"). Shifrlangan xom qiymat javobga hech qachon chiqarilmaydi — shu
// sababli natija obyektidan card_number_encrypted avtomatik olib tashlanadi.
export function withDisplayCard<T extends { status: string; card_number?: string | null; card_number_encrypted?: string | null; card_last4?: string | null }>(row: T): Omit<T, "card_number_encrypted"> & { card_number: string | null } {
  const { card_number_encrypted, ...rest } = row;
  const pending = row.status === "pending";
  let card_number: string | null;

  if (card_number_encrypted) {
    if (pending) {
      try { card_number = decryptCardNumber(card_number_encrypted); }
      catch (e) { console.error("Pul yechish: karta deshifrlashda xato:", e); card_number = `•••• ${row.card_last4 || "????"}`; }
    } else {
      card_number = `•••• ${row.card_last4 || "????"}`;
    }
  } else if (row.card_number) {
    // Eski (shifrlanmagan) tarixiy yozuvlar — ochiq saqlangan, deshifrlash shart emas.
    card_number = pending ? row.card_number : maskCard(row.card_number);
  } else {
    card_number = null;
  }

  return { ...rest, card_number };
}


// TRENERning O'Z pul yechish ro'yxati (GET /api/payouts) uchun ko'rinish. Admin'dan farqli: trener hech qachon TO'LIQ karta
// raqamini ham, shifrlangan qiymatni ham, hal qilgan admin id'sini ham olmaydi (karta har bir so'rovda qayta kiritiladi).
//   card_last4  — oxirgi 4 raqam (yangi so'rovlarda ustundan; eski shifrlanmagan yozuvlarda raqamdan olinadi)
//   card_masked — "•••• 1234" (karta ma'lum bo'lmasa null)
//   card_number — ESKI nom (sayt/Android o'qiydi): endi HAR DOIM maskalangan qiymat, to'liq raqam emas
//   reject_reason — faqat status 'rejected' bo'lganda admin izohi (aks holda null); admin_note ham saqlanadi
export function toTrainerPayout(row: any) {
  const legacyDigits = typeof row.card_number === "string" ? digitsOnly(row.card_number) : "";
  const last4 = typeof row.card_last4 === "string" && /^\d{4}$/.test(row.card_last4) ? row.card_last4 : legacyDigits.length >= 4 ? legacyDigits.slice(-4) : null;
  const masked = last4 ? `•••• ${last4}` : null;
  return {
    id: row.id, trainer_id: row.trainer_id, amount: row.amount, status: row.status,
    requested_at: row.requested_at, completed_at: row.completed_at ?? null,
    admin_note: row.admin_note ?? null, reject_reason: row.status === "rejected" ? (row.admin_note ?? null) : null,
    card_holder: row.card_holder ?? null, card_last4: last4, card_masked: masked, card_number: masked,
  };
}
