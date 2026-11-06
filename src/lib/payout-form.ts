import { digitsOnly, holderValid, luhnValid, normalizeHolder } from "@/lib/card";

export interface PayoutFormInput {
  amount: string;
  card: string;
  holder: string;
  balance: number;
  min: number;
}

export interface PayoutFormResult {
  ok: boolean;
  amountNum: number;
  cardDigits: string;
  holderNorm: string;
  errors: { amount?: string; card?: string; holder?: string };
}

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// Pul yechish formasini tekshirish (brauzerda). Server va DB ham xuddi shu qoidalarni qayta tekshiradi.
export function validatePayoutForm({ amount, card, holder, balance, min }: PayoutFormInput): PayoutFormResult {
  const errors: PayoutFormResult["errors"] = {};
  const amountNum = parseInt(digitsOnly(amount), 10) || 0;
  const cardDigits = digitsOnly(card);
  const holderNorm = normalizeHolder(holder);

  if (amountNum <= 0) errors.amount = "Summani kiriting";
  else if (amountNum < min) errors.amount = `Minimum ${fmt(min)} so'm`;
  else if (amountNum > balance) errors.amount = "Balansdagi summadan ko'p";

  if (cardDigits.length !== 16) errors.card = "Karta raqami 16 ta raqamdan iborat bo'lishi kerak";
  else if (!luhnValid(cardDigits)) errors.card = "Karta raqami noto'g'ri — raqamlarni tekshiring";

  if (!holderValid(holderNorm)) errors.holder = "Karta egasini lotin harflarida, kartadagidek yozing (ALI VALIYEV)";

  return { ok: Object.keys(errors).length === 0, amountNum, cardDigits, holderNorm, errors };
}
