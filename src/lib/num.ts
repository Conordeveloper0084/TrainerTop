// So'rovdan kelgan qiymatni QAT'IY songa aylantirish: bo'sh satr, true/false, massiv, null → null.
// (Number("") = 0 va Number(true) = 1 kabi jimgina noto'g'ri qiymatlarga yo'l qo'ymaydi.)
export function strictNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
