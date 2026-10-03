// Umumiy "cursor" sahifalash yordamchisi. Ilovada cheksiz skroll (infinite scroll) uchun kerak —
// ?limit=20&cursor=... berilsa {items, next_cursor} qaytaradi, berilmasa (parametrlar yo'q bo'lsa)
// eski (butun ro'yxat) xatti-harakat SAQLANIB QOLADI — sayt buzilmasligi uchun.
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export interface PageParams {
  paginate: boolean;   // true — ?limit yoki ?cursor berilgan (yangi rejim)
  limit: number;
  cursor: string | null;
}

export function parsePageParams(sp: URLSearchParams): PageParams {
  const rawLimit = sp.get("limit");
  const cursor = sp.get("cursor");
  const paginate = rawLimit !== null || cursor !== null;
  let limit = parseInt(rawLimit || "", 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  limit = Math.min(limit, MAX_LIMIT);
  return { paginate, limit, cursor: cursor || null };
}

// `rows` — DB'dan (limit+1) ta so'ralgan natija (bor-yo'qligini bilish uchun bittasi ortiqcha).
// `cursorOf` — navbatdagi sahifa uchun cursor qiymatini shu qatordan oladi (masalan created_at yoki rating).
export function buildPage<T>(rows: T[], limit: number, cursorOf: (row: T) => string): { items: T[]; next_cursor: string | null } {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  return { items, next_cursor: hasMore && items.length > 0 ? cursorOf(items[items.length - 1]) : null };
}
