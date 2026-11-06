// Karta ma'lumotlari — brauzer va server uchun umumiy tekshiruvlar.
// DB (request_payout) ham xuddi shu qoidalar bilan qayta tekshiradi.

export function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

// Luhn tekshiruvi: bitta raqam xato yoki ikki raqam o'rni almashgan bo'lsa ushlaydi
export function luhnValid(card: string): boolean {
  if (!/^\d{16}$/.test(card)) return false;
  let sum = 0;
  let alt = false;
  for (let i = card.length - 1; i >= 0; i--) {
    let d = card.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// "8600123456789012" → "8600 1234 5678 9012"
export function formatCard(s: string): string {
  return digitsOnly(s).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function maskCard(card: string): string {
  const d = digitsOnly(card);
  return d.length >= 4 ? `•••• ${d.slice(-4)}` : "••••";
}

export function normalizeHolder(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim().toUpperCase();
}

// Karta egasi: lotin harflari, bo'shliq, apostrof, nuqta, defis; kamida 2 ta harf
export function holderValid(s: string): boolean {
  const h = normalizeHolder(s);
  return /^[A-Za-z'`ʻʼ’‘. -]{3,60}$/.test(h) && /[A-Za-z].*[A-Za-z]/.test(h);
}
