import { supabaseAdmin } from "@/lib/supabase/admin";
import { MOD_NOTE_MAX } from "@/lib/chat-moderation";

const ERRORS: Record<string, [number, string]> = {
  GROUP_NOT_FOUND: [404, "Guruh topilmadi"],
  MEMBER_NOT_FOUND: [404, "A'zo topilmadi"],
  FORBIDDEN: [403, "Faqat guruh admini chora ko'ra oladi"],
  TARGET_IS_OWNER: [400, "Guruh egasiga chora ko'rib bo'lmaydi"],
  SELF: [400, "O'zingizga chora ko'ra olmaysiz"],
  REASON_REQUIRED: [400, "Sababni tanlang"],
  NOTE_REQUIRED: [400, "\"Boshqa sabab\" tanlansa izoh yozish shart"],
  NOTE_TOO_LONG: [400, `Izoh ${MOD_NOTE_MAX} belgidan oshmasin`],
  BAD_DURATION: [400, "Cheklash muddatini tanlang"],
  BAD_ACTION: [400, "Noto'g'ri amal"],
  STATE_INVALID: [409, "A'zoning holati bu amalga mos emas (ehtimol allaqachon o'zgargan)"],
  ADMIN_LOCKED: [403, "Bu chorani administratsiya qo'ygan — faqat admin o'zgartira oladi"],
};

export type ModerationBody = { action?: any; reason?: any; note?: any; duration?: any };

export async function moderateMember(args: { groupId: string; target: string; actorId: string; actorIsAdmin: boolean; body: ModerationBody }):
  Promise<{ ok: true; data: any } | { ok: false; status: number; message: string }> {
  const { groupId, target, actorId, actorIsAdmin, body } = args;
  const b = body && typeof body === "object" ? body : {};
  if (typeof b.action !== "string") return { ok: false, status: 400, message: "Amalni tanlang (cheklash, chiqarish...)" };
  const { data, error } = await supabaseAdmin.rpc("chat_group_moderate", {
    p_group: groupId, p_target: target, p_actor: actorId, p_actor_admin: actorIsAdmin,
    p_action: b.action, p_reason: typeof b.reason === "string" ? b.reason : null,
    p_note: typeof b.note === "string" ? b.note : null, p_duration: typeof b.duration === "string" ? b.duration : null,
  });
  if (error) {
    const key = Object.keys(ERRORS).find((k) => String(error.message || "").includes(k));
    if (key) return { ok: false, status: ERRORS[key][0], message: ERRORS[key][1] };
    throw error;
  }
  return { ok: true, data };
}
