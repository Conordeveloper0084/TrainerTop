// Rasmiy "TrainerTop" kanali (e'lonlar) — brauzerda ham, serverda ham ishlatiladigan umumiy qismlar
export const ANNOUNCE_TITLE_MAX = 80;
export const ANNOUNCE_BODY_MAX = 2000;
export const ANNOUNCE_LABEL_MAX = 40;
export const ANNOUNCE_LINK_MAX = 500;
export const ANNOUNCE_PAGE_SIZE = 30;
export const CHANNEL_NAME_MAX = 40;
export const CHANNEL_BIO_MAX = 200;

// Boost qilingan darslik kartochkasi uchun (e'lon bilan birga keladi; narx o'zgarsa yangisi ko'rinadi)
export interface AnnouncementLesson {
  id: string; title: string; cover_image_url: string | null; price?: number | null;
  price_lifetime?: number | null; price_monthly?: number | null; pricing_model?: string | null; trainer_name: string | null;
}
export interface AnnouncementItem {
  id: string; kind: "all" | "user"; title: string | null; body: string | null;
  image_url: string | null; video_url: string | null; video_thumbnail_url: string | null; video_duration: number | null;
  link_url: string | null; link_label: string | null; created_at: string; edited_at?: string | null;
  views_count?: number; comments_count?: number;
  lesson?: AnnouncementLesson | null;
}
export const COMMENT_MAX = 500;
export interface AnnouncementComment {
  id: string; body: string; created_at: string; user_id: string;
  profiles: { full_name: string | null; avatar_url: string | null; username: string | null } | null;
}
export const BOOST_TEXT_MAX = 300;
export interface OfficialSummary {
  unread: number;
  latest: { id: string; title: string | null; preview: string; kind: "all" | "user"; created_at: string } | null;
}
// Kanal identifikatori (nom, rasm, bio, @username) — bosh sahifa/chatda ko'rsatiladigan ommaviy qism
export interface ChannelIdentity { name: string; avatar_url: string | null; bio: string | null; username: string | null; subscribers?: number }

// Xavfsiz havola: faqat sayt ichidagi yo'l ("/lessons/...") yoki https://. 
// "javascript:", "data:", "http:", "//evil.com", "/\evil.com", bo'shliq va boshqaruv belgilari — rad etiladi.
export function safeLink(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const u = url.trim();
  if (!u || u.length > ANNOUNCE_LINK_MAX || /[\s\u0000-\u001f\u007f]/.test(u)) return null;
  if (u.startsWith("/")) return u.startsWith("//") || u.includes("\\") ? null : u;
  try {
    const p = new URL(u);
    return p.protocol === "https:" && !p.username && !p.password ? u : null;
  } catch { return null; }
}
export const isExternalLink = (u: string) => /^https:\/\//i.test(u);
