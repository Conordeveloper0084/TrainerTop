import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGroupAccess, getMemberMod, isCurrentlyMuted } from "@/lib/chat";
import { CHAT_TEXT_MAX } from "@/lib/constants";

// VIDEO bo'yicha savol (va trenerning birinchi javobi) darslikning GURUH CHATIGA matn xabari bo'lib tushadi
// (migration-v32: messages.video_title / lesson_question_id / lesson_question_kind). Savolning o'zi saqlanishiga
// bu hech qachon ta'sir qilmaydi: hamma xato ushlanadi va sabab qaytariladi.
//
// Xabar formati (hamma mijoz uchun):
//   type: "text"
//   content: "📹 <video_title>\n<savol>"                    (kind "question", yuboruvchi — savol bergan)
//            "📹 <video_title>\n↩️ Javob: <javob>"            (kind "answer",   yuboruvchi — trener)
//   video_title, lesson_question_id, lesson_question_kind    — ilova chiroyli belgi chizishi uchun
//   (eski mijozlar — website/Android — "📹 …" qatori tufayli kontekstni oddiy matnda ko'radi)
// Guruh PUSH'i yuborilmaydi: trenerga "yangi savol", savol egasiga "javob berildi" bildirishnomasi allaqachon bor.

export type MirrorKind = "question" | "answer";
export type MirrorSkip = "no_video" | "no_group" | "no_access" | "muted" | "no_question_message" | "duplicate" | "error";
export type MirrorResult = { posted: true; messageId: string } | { posted: false; reason: MirrorSkip };

export const ANSWER_PREFIX = "↩️ Javob: ";

export function mirrorContent(kind: MirrorKind, videoTitle: string, text: string): string {
  const body = (kind === "answer" ? ANSWER_PREFIX : "") + text;
  return `📹 ${videoTitle}\n${body}`.slice(0, CHAT_TEXT_MAX);
}

export async function mirrorLessonQuestion(opts: {
  lessonId: string; senderId: string; questionId: string; videoTitle: string | null | undefined; text: string; kind: MirrorKind;
}): Promise<MirrorResult> {
  const { lessonId, senderId, questionId, text, kind } = opts;
  const videoTitle = (opts.videoTitle || "").trim();
  if (!videoTitle || !text.trim()) return { posted: false, reason: "no_video" };
  try {
    // 1) darslikning guruhi
    const { data: group, error: gErr } = await supabaseAdmin.from("chat_groups").select("id").eq("lesson_id", lessonId).maybeSingle();
    if (gErr) throw gErr;
    if (!group) return { posted: false, reason: "no_group" };

    // 2) yuboruvchi guruhga yoza oladimi (xuddi oddiy guruh xabari kabi: egasi/faol a'zo, mute emas)
    const access = await getGroupAccess(group.id, senderId);
    if (access !== "owner" && access !== "active") return { posted: false, reason: "no_access" };
    if (access === "active") {
      const mod = await getMemberMod(group.id, senderId);
      if (mod && isCurrentlyMuted(mod.muted_until)) return { posted: false, reason: "muted" };
    }

    // 3) javob — faqat savol xabari guruhda bo'lsa (savolsiz yolg'iz "javob" chalkashtiradi)
    if (kind === "answer") {
      const { data: q, error: qErr } = await supabaseAdmin.from("messages").select("id")
        .eq("lesson_question_id", questionId).eq("lesson_question_kind", "question").limit(1).maybeSingle();
      if (qErr) throw qErr;
      if (!q) return { posted: false, reason: "no_question_message" };
    }

    // 4) xabarni yozish
    const { data: msg, error } = await supabaseAdmin.from("messages").insert({
      group_id: group.id, sender_id: senderId, type: "text", content: mirrorContent(kind, videoTitle, text),
      video_title: videoTitle, lesson_question_id: questionId, lesson_question_kind: kind,
    }).select("id").single();
    if (error) {
      if ((error as any).code === "23505") return { posted: false, reason: "duplicate" };   // allaqachon aks ettirilgan
      throw error;
    }

    // yuboruvchining o'zi uchun "o'qildi" (o'z xabari o'qilmagan bo'lib qolmasin) — oddiy guruh xabaridagidek
    await supabaseAdmin.from("chat_group_members").update({ last_read_at: new Date().toISOString() }).eq("group_id", group.id).eq("user_id", senderId);
    return { posted: true, messageId: (msg as any).id };
  } catch (e) {
    console.error("Savolni guruhga aks ettirish:", e);
    return { posted: false, reason: "error" };
  }
}
