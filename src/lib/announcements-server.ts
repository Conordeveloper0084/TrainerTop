import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeLink, ANNOUNCE_TITLE_MAX, ANNOUNCE_BODY_MAX, ANNOUNCE_LABEL_MAX } from "@/lib/announcements";
import { keyFromPublicUrl, keyBelongsToUser } from "@/lib/media";
import { VIDEO_POST_MAX_SECONDS } from "@/lib/constants";
import { UUID_RE } from "@/lib/db-errors";

const ERRORS: Record<string, [number, string]> = {
  FORBIDDEN: [403, "Faqat admin e'lon yubora oladi"],
  BAD_KIND: [400, "Auditoriyani tanlang (hammaga yoki bitta foydalanuvchiga)"],
  BAD_TARGET: [400, "Hammaga e'lon uchun foydalanuvchi tanlanmaydi"],
  TARGET_REQUIRED: [400, "Foydalanuvchini tanlang"],
  TARGET_NOT_FOUND: [404, "Foydalanuvchi topilmadi"],
  BAD_TITLE: [400, `Sarlavha ${ANNOUNCE_TITLE_MAX} belgidan oshmasin`],
  BAD_BODY: [400, `Matn ${ANNOUNCE_BODY_MAX} belgidan oshmasin`],
  EMPTY_POST: [400, "Matn, rasm yoki video kerak"],
  BAD_LINK: [400, "Havola, tugma yozuvi, rasm yoki video manzili noto'g'ri"],
  RATE_LIMIT: [429, "Soatiga ko'pi bilan 5 ta umumiy e'lon yuborish mumkin. Keyinroq urinib ko'ring"],
  NOT_FOUND: [404, "Post topilmadi"],
  NOT_EDITABLE: [400, "Faqat kanal postini (avtomatik boost emas) tahrirlash mumkin"],
};

export type SendResult = { ok: true; id: string; recipients: number; duplicate: boolean } | { ok: false; status: number; message: string };
export type EditResult = { ok: true; edited_at: string } | { ok: false; status: number; message: string };
type ContentOk = {
  ok: true; title: string | null; text: string | null; link: string | null; label: string | null;
  image: string | null; video: string | null; videoThumb: string | null; videoDuration: number | null;
};
type ContentBad = { ok: false; status: number; message: string };

// Sarlavha/matn/havola/rasm/video — post yaratish VA tahrirlashda BIR XIL qoidalar bilan tekshiriladi.
// Erkin post: sarlavha ixtiyoriy, matn ixtiyoriy (rasm yoki video bo'lsa), lekin kamida bittasi kerak.
function validateContent(adminId: string, body: any): ContentOk | ContentBad {
  const bad = (message: string, status = 400): ContentBad => ({ ok: false, status, message });
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (title.length > ANNOUNCE_TITLE_MAX) return bad(ERRORS.BAD_TITLE[1]);
  if (text.length > ANNOUNCE_BODY_MAX) return bad(ERRORS.BAD_BODY[1]);

  let link: string | null = null;
  if (typeof body.link_url === "string" && body.link_url.trim()) {
    link = safeLink(body.link_url);
    if (!link) return bad("Havola noto'g'ri: faqat sayt ichidagi yo'l (masalan /lessons) yoki https:// bilan boshlanadigan manzil");
  }
  const label = typeof body.link_label === "string" && body.link_label.trim() ? body.link_label.trim() : null;
  if (label && label.length > ANNOUNCE_LABEL_MAX) return bad(`Tugma yozuvi ${ANNOUNCE_LABEL_MAX} belgidan oshmasin`);

  let image: string | null = null;
  if (typeof body.image_url === "string" && body.image_url.trim()) {
    const key = keyFromPublicUrl(body.image_url.trim());
    // Rasm faqat shu adminning o'zi yuklagan (channel/, posts/ yoki uploads/) fayl bo'lishi mumkin
    if (!key || !["channel", "posts", "uploads"].includes(key.split("/")[0]) || !keyBelongsToUser(key, adminId)) return bad("Rasm manzili noto'g'ri. Rasmni shu sahifadan yuklang");
    image = body.image_url.trim();
  }

  let video: string | null = null; let videoThumb: string | null = null; let videoDuration: number | null = null;
  if (typeof body.video_url === "string" && body.video_url.trim()) {
    if (image) return bad("Rasm va video birga bo'lmaydi");
    const key = keyFromPublicUrl(body.video_url.trim());
    if (!key || key.split("/")[0] !== "channel" || !keyBelongsToUser(key, adminId)) return bad("Video manzili noto'g'ri. Videoni shu sahifadan yuklang");
    video = body.video_url.trim();
    if (typeof body.video_thumbnail_url === "string" && body.video_thumbnail_url.trim()) {
      const tkey = keyFromPublicUrl(body.video_thumbnail_url.trim());
      if (!tkey || tkey.split("/")[0] !== "channel" || !keyBelongsToUser(tkey, adminId)) return bad("Video muqovasi noto'g'ri");
      videoThumb = body.video_thumbnail_url.trim();
    }
    const d = Math.round(Number(body.video_duration));
    videoDuration = Number.isFinite(d) && d >= 1 ? Math.min(d, VIDEO_POST_MAX_SECONDS) : null;
  }

  if (!text && !image && !video) return bad(ERRORS.EMPTY_POST[1]);
  return { ok: true, title: title || null, text: text || null, link, label, image, video, videoThumb, videoDuration };
}

// Admin so'rovini tekshiradi (tushunarli xabar bilan) va DB funksiyasi orqali yuboradi.
export async function sendAnnouncement(adminId: string, b: any): Promise<SendResult> {
  const body = b && typeof b === "object" ? b : {};
  const bad = (message: string, status = 400): SendResult => ({ ok: false, status, message });
  const kind = body.kind === "all" || body.kind === "user" ? body.kind : null;
  if (!kind) return bad(ERRORS.BAD_KIND[1]);
  let target: string | null = null;
  if (kind === "user") { if (typeof body.target_user_id !== "string" || !UUID_RE.test(body.target_user_id)) return bad(ERRORS.TARGET_REQUIRED[1]); target = body.target_user_id; }

  const c = validateContent(adminId, body);
  if (c.ok === false) return { ok: false, status: c.status, message: c.message };
  const token = typeof body.client_token === "string" && UUID_RE.test(body.client_token) ? body.client_token : null;

  const { data, error } = await supabaseAdmin.rpc("announcement_send", {
    p_admin: adminId, p_kind: kind, p_target: target, p_title: c.title, p_body: c.text,
    p_image: c.image, p_link: c.link, p_link_label: c.label, p_token: token,
    p_video: c.video, p_video_thumb: c.videoThumb, p_video_duration: c.videoDuration,
  });
  if (error) {
    const key = Object.keys(ERRORS).find((k) => String(error.message || "").includes(k));
    if (key) return { ok: false, status: ERRORS[key][0], message: ERRORS[key][1] };
    throw error;
  }
  return { ok: true, id: data.id, recipients: Number(data.recipients) || 0, duplicate: !!data.duplicate };
}

// Mavjud KANAL postini (kind='all', lesson_id yo'q, o'chirilmagan) tahrirlaydi. Auditoriya/kind o'zgarmaydi.
export async function editAnnouncement(adminId: string, announcementId: string, b: any): Promise<EditResult> {
  const body = b && typeof b === "object" ? b : {};
  const bad = (message: string, status = 400): EditResult => ({ ok: false, status, message });
  if (!UUID_RE.test(announcementId)) return bad(ERRORS.NOT_FOUND[1], 404);

  const { data: existing, error: fetchErr } = await supabaseAdmin.from("announcements")
    .select("id, kind, lesson_id, deleted_at").eq("id", announcementId).maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!existing || existing.deleted_at) return bad(ERRORS.NOT_FOUND[1], 404);
  if (existing.kind !== "all" || existing.lesson_id) return bad(ERRORS.NOT_EDITABLE[1]);

  const c = validateContent(adminId, body);
  if (c.ok === false) return { ok: false, status: c.status, message: c.message };

  const editedAt = new Date().toISOString();
  const { error } = await supabaseAdmin.from("announcements").update({
    title: c.title, body: c.text, link_url: c.link, link_label: c.label,
    image_url: c.image, video_url: c.video, video_thumbnail_url: c.videoThumb, video_duration: c.videoDuration,
    edited_at: editedAt,
  }).eq("id", announcementId);
  if (error) throw error;
  return { ok: true, edited_at: editedAt };
}
