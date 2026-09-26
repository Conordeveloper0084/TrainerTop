import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { keyFromPublicUrl, keyBelongsToUser } from "@/lib/media";
import { UUID_RE } from "@/lib/db-errors";
import {
  CHAT_TEXT_MAX, CHAT_CAPTION_MAX, CHAT_VOICE_MAX_SECONDS, CHAT_VOICE_MAX_BYTES,
  CHAT_VIDEO_MAX_SECONDS, CHAT_VIDEO_MAX_BYTES, CHAT_PAGE_SIZE,
} from "@/lib/constants";

export type MessageType = "text" | "image" | "voice" | "video";
export type GroupAccess = "owner" | "active" | "expired" | "removed" | "none";

export interface OutgoingRow {
  type: MessageType;
  content: string | null;
  media_url: string | null;
  media_mime: string | null;
  media_duration: number | null;
  media_size: number | null;
  thumb_url: string | null;
  image_url: string | null; // eski mijozlar uchun (faqat rasm)
}
export type ValidationResult = { ok: true; row: OutgoingRow } | { ok: false; status: number; message: string };

const EXT: Record<"image" | "voice" | "video", string[]> = {
  image: ["jpg", "jpeg", "png", "webp", "gif"],
  voice: ["webm", "ogg", "m4a", "mp4", "mp3", "aac", "wav"],
  video: ["mp4", "mov", "webm", "m4v"],
};

// Media havolasi: bizning R2 domenimiz, chat/ papkasi, YUBORUVCHINING o'z papkasi, mos kengaytma.
// (Boshqa odamning faylini yoki tashqi havolani xabarga bog'lab bo'lmaydi.)
export function chatMediaKey(url: unknown, userId: string, kind: "image" | "voice" | "video"): string | null {
  const key = keyFromPublicUrl(url);
  if (!key || !key.startsWith("chat/") || !keyBelongsToUser(key, userId)) return null;
  const ext = key.split(".").pop()?.toLowerCase();
  return ext && EXT[kind].includes(ext) ? key : null;
}

const fail = (message: string, status = 400): ValidationResult => ({ ok: false, status, message });
const posInt = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

export function validateOutgoing(body: any, userId: string): ValidationResult {
  const b = body && typeof body === "object" ? body : {};
  const legacyImage = typeof b.image_url === "string" && b.image_url ? b.image_url : null;
  const type: MessageType = ["text", "image", "voice", "video"].includes(b.type) ? b.type : legacyImage ? "image" : "text";
  const content = typeof b.content === "string" && b.content.trim() ? b.content.trim() : null;

  const empty: OutgoingRow = { type, content: null, media_url: null, media_mime: null, media_duration: null, media_size: null, thumb_url: null, image_url: null };

  if (type === "text") {
    if (!content) return fail("Xabar bo'sh");
    if (content.length > CHAT_TEXT_MAX) return fail(`Xabar juda uzun (maksimum ${CHAT_TEXT_MAX} belgi)`);
    return { ok: true, row: { ...empty, content } };
  }

  if (content && content.length > CHAT_CAPTION_MAX) return fail(`Izoh juda uzun (maksimum ${CHAT_CAPTION_MAX} belgi)`);
  const mediaUrl = typeof b.media_url === "string" && b.media_url ? b.media_url : legacyImage;
  if (!mediaUrl || !chatMediaKey(mediaUrl, userId, type)) return fail("Fayl havolasi noto'g'ri. Faylni qayta yuklang");

  const size = b.media_size == null ? null : posInt(b.media_size);
  const mime = typeof b.media_mime === "string" ? b.media_mime.slice(0, 100) : null;
  const duration = b.media_duration == null ? null : posInt(b.media_duration);

  if (type === "image") {
    if (size && size > 20 * 1024 * 1024) return fail("Rasm juda katta");
    return { ok: true, row: { ...empty, content, media_url: mediaUrl, media_mime: mime, media_size: size, image_url: mediaUrl } };
  }

  if (type === "voice") {
    if (!duration) return fail("Ovozli xabar davomiyligi kerak");
    if (duration > CHAT_VOICE_MAX_SECONDS) return fail(`Ovozli xabar ${Math.round(CHAT_VOICE_MAX_SECONDS / 60)} daqiqadan oshmasligi kerak`);
    if (size && size > CHAT_VOICE_MAX_BYTES) return fail("Ovozli xabar juda katta");
    return { ok: true, row: { ...empty, media_url: mediaUrl, media_mime: mime, media_duration: duration, media_size: size } };
  }

  // video
  if (!duration) return fail("Video davomiyligi kerak");
  if (duration > CHAT_VIDEO_MAX_SECONDS) return fail(`Video ${Math.round(CHAT_VIDEO_MAX_SECONDS / 60)} daqiqadan oshmasligi kerak`);
  if (size && size > CHAT_VIDEO_MAX_BYTES) return fail("Video juda katta");
  let thumb: string | null = null;
  if (b.thumb_url) {
    if (!chatMediaKey(b.thumb_url, userId, "image")) return fail("Muqova havolasi noto'g'ri");
    thumb = b.thumb_url;
  }
  return { ok: true, row: { ...empty, content, media_url: mediaUrl, media_mime: mime, media_duration: duration, media_size: size, thumb_url: thumb } };
}

// Suhbat ro'yxatidagi qisqa matn (1:1)
export function messagePreview(type: MessageType, content: string | null): string {
  if (type === "voice") return "🎤 Ovozli xabar";
  if (type === "image") return content ? content.slice(0, 100) : "📷 Rasm";
  if (type === "video") return content ? content.slice(0, 100) : "🎬 Video";
  return (content || "").slice(0, 100);
}

// ---- Ruxsatlar ----
export async function getConversationForUser(convId: string, userId: string) {
  if (!UUID_RE.test(convId)) return null;
  const { data } = await supabaseAdmin
    .from("conversations")
    .select("id, trainer_id, user_id, trainer_unread, user_unread")
    .eq("id", convId)
    .or(`trainer_id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();
  return data || null;
}

export async function getGroupAccess(groupId: string, userId: string): Promise<GroupAccess> {
  if (!UUID_RE.test(groupId)) return "none";
  const { data, error } = await supabaseAdmin.rpc("group_access", { p_group: groupId, p_user: userId });
  if (error) throw error;
  return (["owner", "active", "expired", "removed"].includes(data) ? data : "none") as GroupAccess;
}

// ---- Xabarlar sahifasi (eng oxirgi N ta yoki `before` dan oldingi N ta), eskisi tepada ----
const validIso = (v: string | null) => (v && !Number.isNaN(Date.parse(v)) ? v : null);

export async function queryMessages(column: "conversation_id" | "group_id", id: string, sp: URLSearchParams) {
  const n = parseInt(sp.get("limit") || "", 10);
  const limit = Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : CHAT_PAGE_SIZE;
  const before = validIso(sp.get("before"));
  let q = supabaseAdmin.from("messages").select(`*, sender:sender_id (id, full_name, avatar_url)`).eq(column, id);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []).reverse();
}
export const isInitialLoad = (sp: URLSearchParams) => !validIso(sp.get("before"));

// ---- A'zoning joriy moderatsiya holati (cheklov / chiqarish tafsilotlari) ----
export interface MemberMod {
  status: string; muted_until: string | null; mod_reason: string | null; mod_note: string | null;
  mod_by_admin: boolean; mod_at: string | null; dismissed_at: string | null;
}
export async function getMemberMod(groupId: string, userId: string): Promise<MemberMod | null> {
  const { data } = await supabaseAdmin.from("chat_group_members")
    .select("status, muted_until, mod_reason, mod_note, mod_by_admin, mod_at, removed_at, dismissed_at")
    .eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return { ...(data as any), mod_at: (data as any).mod_at || (data as any).removed_at || null };
}
export const isCurrentlyMuted = (until: string | null | undefined) =>
  !!until && (until === "infinity" || new Date(until).getTime() > Date.now());

// ---- Xabarni hamma uchun o'chirish (yumshoq): matn/fayl tozalanadi, fayl R2'dan ham o'chadi ----
export async function softDeleteMessage(msg: { id: string; media_url?: string | null; thumb_url?: string | null }, deletedBy: string) {
  const { error } = await supabaseAdmin.from("messages").update({
    deleted_at: new Date().toISOString(), deleted_by: deletedBy,
    content: null, media_url: null, media_mime: null, media_duration: null, media_size: null, thumb_url: null, image_url: null,
  }).eq("id", msg.id);
  if (error) throw error;
  for (const url of [msg.media_url, msg.thumb_url]) {
    const key = keyFromPublicUrl(url);
    if (key && key.startsWith("chat/")) {
      try { await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })); } catch (e) { console.error("R2 delete:", e); }
    }
  }
}

// ---- Guruh a'zolari ro'yxati (trener va admin uchun): holat + chora tafsilotlari ----
export async function buildMemberList(groupId: string, lessonId: string) {
  const { data: rows, error } = await supabaseAdmin
    .from("chat_group_members")
    .select("user_id, role, status, joined_at, muted_until, mod_reason, mod_note, mod_by_admin, mod_at, removed_at, dismissed_at, profile:user_id (id, full_name, avatar_url)")
    .eq("group_id", groupId);
  if (error) throw error;
  const ids = (rows || []).map((r: any) => r.user_id);
  const { data: purchases } = ids.length
    ? await supabaseAdmin.from("purchases").select("user_id, purchase_type, expires_at").eq("lesson_id", lessonId).eq("status", "paid").in("user_id", ids)
    : { data: [] as any[] };
  const pmap = new Map((purchases || []).map((p: any) => [p.user_id, p]));
  const now = Date.now();
  return (rows || []).map((r: any) => {
    const p: any = pmap.get(r.user_id);
    const state =
      r.role === "owner" ? "owner"
      : r.status === "left" ? "left"
      : r.status === "removed" ? "removed"
      : !p ? "none"
      : p.purchase_type === "monthly" && p.expires_at && new Date(p.expires_at).getTime() <= now ? "expired"
      : isCurrentlyMuted(r.muted_until) ? "muted"
      : "active";
    return {
      user_id: r.user_id, role: r.role, status: r.status, state, joined_at: r.joined_at,
      muted_until: isCurrentlyMuted(r.muted_until) ? r.muted_until : null,
      mod_reason: r.mod_reason, mod_note: r.mod_note, mod_by_admin: !!r.mod_by_admin, mod_at: r.mod_at || r.removed_at || null,
      purchase_type: p?.purchase_type ?? null, expires_at: p?.expires_at ?? null,
      full_name: r.profile?.full_name || "", avatar_url: r.profile?.avatar_url || null,
    };
  }).sort((a: any, b: any) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.full_name.localeCompare(b.full_name)));
}
