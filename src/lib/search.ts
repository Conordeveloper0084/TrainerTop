// PostgREST .or()/.ilike() filtrlariga foydalanuvchi matnini xavfsiz qo'yish:
// vergul, qavs, foiz va yulduzcha filtr sintaksisini buzishi mumkin.
export function sanitizeSearch(input: string | null | undefined, max = 60): string {
  return (input || "").replace(/[,()%*\\"'`;:]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

// LIKE/ILIKE naqshiga foydalanuvchi matnini "harfma-harf" qo'yish: \ % _ ekranlanadi
// (aks holda "50%" yoki "a_b" qidiruvi kutilmagan narsalarga mos kelardi). Postgres'da
// ekran belgisi standart bo'yicha teskari slesh. Eslatma: PostgREST naqshdagi `*` ni
// `%` deb o'qiydi — bu faqat qidiruvni kengaytiradi, xavfsizlik muammosi emas.
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, "\\$&");
}
