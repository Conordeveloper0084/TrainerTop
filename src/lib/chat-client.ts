// Chat uchun sof (toza) yordamchi funksiyalar — brauzerda ham, testlarda ham ishlaydi.

import { reasonLabel } from "@/lib/chat-moderation";

export type MessageType = "text" | "image" | "voice" | "video";

export interface ChatMessage {
  id: string;
  sender_id: string;
  conversation_id?: string | null;
  group_id?: string | null;
  content: string | null;
  type: MessageType;
  media_url: string | null;
  media_mime?: string | null;
  media_duration?: number | null;
  media_size?: number | null;
  thumb_url?: string | null;
  image_url?: string | null;
  deleted_at?: string | null;
  created_at: string;
  sender?: { id?: string; full_name?: string; avatar_url?: string | null } | null;
  pending?: boolean; // hali serverga yuborilmagan (vaqtinchalik)
}

export interface GroupSummary {
  id: string;
  lesson_id: string;
  name: string;
  avatar_url: string | null;
  access: "owner" | "active" | "expired" | "removed";
  role: "owner" | "member";
  last_message: string | null;
  last_message_type: MessageType | null;
  last_message_at: string | null;
  lesson_title: string;
  price_monthly: number | null;
  pricing_model: string | null;
  unread: number;
  muted_until?: string | null;
  mod_reason?: string | null;
  mod_note?: string | null;
  mod_by_admin?: boolean | null;
  mod_at?: string | null;
}

export interface DmSummary {
  id: string;
  other?: { id?: string; full_name?: string; avatar_url?: string | null } | null;
  last_message: string | null;
  last_message_at: string | null;
  my_unread: number;
}

export interface ThreadItem {
  kind: "dm" | "group";
  id: string;
  title: string;
  avatar: string | null;
  subtitle: string;
  time: string | null;
  unread: number;
  locked: boolean;
  removed?: boolean;
  lessonId?: string;
}

// Xabarlarni id bo'yicha birlashtiradi: bir xil id bo'lsa yangisi eskisini almashtiradi (masalan, o'chirilgan xabar),
// vaqtinchalik ("temp-") xabarlar tanlab olinadi, natija vaqt bo'yicha tartiblanadi.
export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of existing) map.set(m.id, m);
  for (const m of incoming) {
    // Kelgan xabarda yo'q (undefined) maydonlar mavjud qiymatni o'chirib yubormasin (masalan, yuboruvchi ma'lumoti)
    const defined = Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)) as unknown as ChatMessage;
    map.set(m.id, { ...map.get(m.id), ...defined, pending: false });
  }
  return Array.from(map.values()).sort((a, b) => {
    const t = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return t !== 0 ? t : a.id.localeCompare(b.id);
  });
}

export function formatVoiceTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Ro'yxatdagi oxirgi xabar matni (guruhlarda tur bo'yicha belgi bilan)
export function lastMessageLabel(type: MessageType | null, text: string | null): string {
  if (type === "voice") return "🎤 Ovozli xabar";
  if (type === "image") return text && text !== "Rasm" ? `📷 ${text}` : "📷 Rasm";
  if (type === "video") return text && text !== "Video" ? `🎬 ${text}` : "🎬 Video";
  return text || "";
}

// 1:1 suhbatlar va guruhlar bitta ro'yxatga: oxirgi faollik bo'yicha (eng yangisi tepada)
export function buildThreadList(dms: DmSummary[], groups: GroupSummary[]): ThreadItem[] {
  const items: ThreadItem[] = [
    ...dms.map((c): ThreadItem => ({
      kind: "dm", id: c.id, title: c.other?.full_name || "Foydalanuvchi", avatar: c.other?.avatar_url || null,
      subtitle: c.last_message || "Yangi chat", time: c.last_message_at, unread: c.my_unread || 0, locked: false,
    })),
    ...groups.map((g): ThreadItem => ({
      kind: "group", id: g.id, title: g.name, avatar: g.avatar_url,
      subtitle: g.access === "expired" ? "Obuna tugagan — kirish uchun to'lang"
        : g.access === "removed" ? `Guruhdan chiqarilgansiz${g.mod_reason ? ` · ${reasonLabel(g.mod_reason)}` : ""}`
        : g.muted_until ? "Yozishingiz cheklangan"
        : g.last_message ? lastMessageLabel(g.last_message_type, g.last_message) : "Darslik guruhi",
      time: g.access === "removed" ? g.mod_at || g.last_message_at : g.last_message_at, unread: g.unread || 0,
      locked: g.access === "expired", removed: g.access === "removed", lessonId: g.lesson_id,
    })),
  ];
  return items.sort((a, b) => (b.time ? new Date(b.time).getTime() : 0) - (a.time ? new Date(a.time).getTime() : 0));
}

export function filterThreads(items: ThreadItem[], query: string): ThreadItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) => i.title.toLowerCase().includes(q) || i.subtitle.toLowerCase().includes(q));
}
