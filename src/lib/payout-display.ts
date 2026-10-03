// Admin'ga pul yechish so'rovini ko'rsatishda karta qanday chiqishini belgilaydi — ikkala joyda
// (ro'yxat va bitta so'rovni hal qilish javobi) bir xil qoidaga rioya qilinishi uchun umumiy.
import { decryptCardNumber } from "@/lib/crypto-card";
import { maskCard } from "@/lib/card";

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
