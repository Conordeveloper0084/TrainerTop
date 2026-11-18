// Like holati: bosilganda optimistik ±1 FAQAT javob kelguncha; keyin son va holat SERVER javobidan olinadi
// (POST /api/posts/{id}/like → { liked, likes_count }). Xato bo'lsa avvalgi holatga qaytadi.
export interface Likeable { is_liked?: boolean; likes_count?: number | null }

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function optimisticLike<T extends Likeable>(post: T): T {
  const liked = !post.is_liked;
  return { ...post, is_liked: liked, likes_count: Math.max(0, count(post.likes_count) + (liked ? 1 : -1)) };
}

export function serverLike<T extends Likeable>(post: T, res: { liked?: unknown; likes_count?: unknown } | null | undefined): T {
  if (!res || typeof res.liked !== "boolean") return post;
  // Eski server (likes_count yo'q) — joriy (optimistik) son saqlanadi
  const n = typeof res.likes_count === "number" && Number.isFinite(res.likes_count) ? Math.max(0, Math.floor(res.likes_count)) : count(post.likes_count);
  return { ...post, is_liked: res.liked, likes_count: n };
}
