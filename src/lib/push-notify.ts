import { supabaseAdmin } from "@/lib/supabase/admin";
import { isPushConfigured, sendPush, sendPushToAll, pushBody } from "@/lib/push";

// Push yuborish nuqtalari. Hammasi `runInBackground(...)` ichida chaqiriladi (javobni kutdirmaydi),
// va push sozlanmagan bo'lsa (FIREBASE_SERVICE_ACCOUNT_JSON yo'q) bazaga ham murojaat qilmasdan qaytadi.
// `route` ilovada shu ko'rinishlarda ochiladi: chat/<conversationId>, chat-group/<groupId>, channel, lesson/<lessonId>.
// `tag` = `route` (bir suhbat/guruh/kanal bildirishnomalari ilovada bitta bo'lib yig'iladi).

const GROUP_THROTTLE_SECONDS = 60;   // guruh + foydalanuvchiga daqiqasiga bittadan
const str = (v: unknown) => (typeof v === "string" ? v : "");

// Yangi 1:1 xabar → qabul qiluvchiga. title = yuboruvchi ismi.
export async function notifyDirectMessage(p: { conversationId: string; senderId: string; senderName: string; recipientId: string; type: string | null | undefined; content: string | null | undefined }) {
  if (!isPushConfigured()) return;
  const route = `chat/${p.conversationId}`;
  await sendPush([p.recipientId], { title: p.senderName || "Yangi xabar", body: pushBody(p.type, p.content), route, tag: route }, { senderId: p.senderId });
}

// Yangi guruh xabari → faol va cheklanmagan a'zolarga (yuboruvchidan tashqari), guruh+foydalanuvchiga
// daqiqasiga bittadan. title = guruh nomi, body = "Yuboruvchi: matn" (guruhda kim yozgani muhim).
// Oluvchilarni tanlash va throttle DB funksiyasida (push_group_recipients) — atomik.
export async function notifyGroupMessage(p: { groupId: string; senderId: string; senderName: string; type: string | null | undefined; content: string | null | undefined }) {
  if (!isPushConfigured()) return;
  const { data, error } = await supabaseAdmin.rpc("push_group_recipients", { p_group: p.groupId, p_sender: p.senderId, p_throttle_seconds: GROUP_THROTTLE_SECONDS });
  if (error) { console.error("push_group_recipients xatosi:", error); return; }
  const ids = (Array.isArray(data) ? data : []).filter((x: unknown): x is string => typeof x === "string");
  if (ids.length === 0) return;
  const { data: g } = await supabaseAdmin.from("chat_groups").select("name").eq("id", p.groupId).maybeSingle();
  const route = `chat-group/${p.groupId}`;
  const who = p.senderName || "Foydalanuvchi";
  await sendPush(ids, { title: g?.name || "Guruh", body: `${who}: ${pushBody(p.type, p.content)}`, route, tag: route }, { senderId: p.senderId });
}

// Kanal e'loni → e'lon auditoriyasiga: kind='all' — hamma, kind='user' — faqat shu foydalanuvchi.
// title = kanal nomi. body: e'lon sarlavhasi/matni, matn bo'lmasa "Video"/"Rasm".
export async function notifyChannelAnnouncement(p: { kind: string; targetUserId: string | null; adminId: string; title?: unknown; text?: unknown; hasImage: boolean; hasVideo: boolean }) {
  if (!isPushConfigured()) return;
  const { data: ch } = await supabaseAdmin.from("channel_settings").select("name").eq("id", 1).maybeSingle();
  const text = [str(p.title).trim(), str(p.text).trim()].filter(Boolean).join(": ");
  const body = text ? pushBody("text", text) : p.hasVideo ? "Video" : p.hasImage ? "Rasm" : "Yangi e'lon";
  const msg = { title: ch?.name || "TrainerTop", body, route: "channel", tag: "channel" };
  if (p.kind === "user") {
    if (p.targetUserId) await sendPush([p.targetUserId], msg, { senderId: p.adminId });
    return;
  }
  if (p.kind !== "all") return;   // noma'lum tur — hech qachon "hammaga" yuborilmasin
  await sendPushToAll(msg, { senderId: p.adminId });
}

// ---------------------------------------------------------------- Darslik savol-javobi
// route = `lesson/<lessonId>` (mavjud `chat/<id>`, `chat-group/<id>` ko'rinishidagi kabi: `<tur>/<id>`),
// tag = route (bir darslik bo'yicha bildirishnomalar ilovada bitta bo'lib yig'iladi).
const shorten = (v: unknown, n: number) => {
  const t = str(v).replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

// Yangi savol → darslik trenerining o'ziga (savol beruvchining o'ziga EMAS).
export async function notifyLessonQuestion(p: { lessonId: string; lessonTitle: string | null | undefined; trainerId: string; askerId: string; question: string }) {
  if (!isPushConfigured()) return;
  if (!p.trainerId || p.trainerId === p.askerId) return;   // trener o'z darsligiga o'zi savol bersa — o'ziga push yo'q
  const route = `lesson/${p.lessonId}`;
  const title = shorten(p.lessonTitle, 40);
  const body = title ? `${title}: ${pushBody("text", p.question)}` : pushBody("text", p.question);
  await sendPush([p.trainerId], { title: "Darsligingizga yangi savol", body, route, tag: route }, { senderId: p.askerId });
}

// Trener javob berdi → savol egasiga.
export async function notifyQuestionAnswered(p: { lessonId: string; lessonTitle: string | null | undefined; trainerId: string; askerId: string; answer: string }) {
  if (!isPushConfigured()) return;
  if (!p.askerId || p.askerId === p.trainerId) return;
  const route = `lesson/${p.lessonId}`;
  const title = shorten(p.lessonTitle, 40);
  const body = title ? `${title}: ${pushBody("text", p.answer)}` : pushBody("text", p.answer);
  await sendPush([p.askerId], { title: "Savolingizga javob berildi", body, route, tag: route }, { senderId: p.trainerId });
}
