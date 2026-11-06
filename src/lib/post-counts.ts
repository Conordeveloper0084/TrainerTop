// Post sanoqlari (likes_count, comments_count, views_count) HAR DOIM son bo'lsin.
// Ustunlar bazada `INTEGER DEFAULT 0` (NOT NULL EMAS) — eski/qo'lda kiritilgan qatorlarda NULL bo'lishi mumkin;
// qat'iy tipli mijoz (Kotlin/Swift) NULL ni o'qiganda 0 ko'rsatadi yoki xato beradi.
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
export function withCounts<T extends Record<string, any>>(p: T): T & { likes_count: number; comments_count: number; views_count: number } {
  return { ...p, likes_count: n(p.likes_count), comments_count: n(p.comments_count), views_count: n(p.views_count) };
}
