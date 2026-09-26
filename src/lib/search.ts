// PostgREST .or()/.ilike() filtrlariga foydalanuvchi matnini xavfsiz qo'yish:
// vergul, qavs, foiz va yulduzcha filtr sintaksisini buzishi mumkin.
export function sanitizeSearch(input: string | null | undefined, max = 60): string {
  return (input || "").replace(/[,()%*\\"'`;:]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
