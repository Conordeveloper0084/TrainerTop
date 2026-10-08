import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getConversationForUser, getGroupAccess } from "@/lib/chat";
import { MOD_REASONS, MOD_NOTE_MAX } from "@/lib/chat-moderation";
import { UUID_RE } from "@/lib/db-errors";

const DAILY_LIMIT = 20;

// POST /api/chat/messages/[id]/report — xabarga shikoyat (guruhda ham, 1:1 da ham).
// Body: { reason: adult|abuse|spam|offtopic|other, note? }. Xabar o'chirilsa ham nusxasi (snapshot) qoladi.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Xabar topilmadi" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason : "";
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    if (!MOD_REASONS.some((r) => r.code === reason)) return NextResponse.json({ message: "Shikoyat sababini tanlang" }, { status: 400 });
    if (reason === "other" && (!note || note.length < 3)) return NextResponse.json({ message: "\"Boshqa sabab\" tanlansa izoh yozing" }, { status: 400 });
    if (note && note.length > MOD_NOTE_MAX) return NextResponse.json({ message: `Izoh ${MOD_NOTE_MAX} belgidan oshmasin` }, { status: 400 });

    const { data: msg } = await supabaseAdmin.from("messages")
      .select("id, sender_id, conversation_id, group_id, type, content, media_url, thumb_url, created_at, deleted_at").eq("id", params.id).maybeSingle();
    if (!msg || msg.deleted_at) return NextResponse.json({ message: "Xabar topilmadi" }, { status: 404 });

    // Faqat o'qiy oladigan xabarga shikoyat qilish mumkin
    if (msg.group_id) {
      const access = await getGroupAccess(msg.group_id, user.id);
      if (access !== "owner" && access !== "active") return NextResponse.json({ message: "Xabar topilmadi" }, { status: 404 });
    } else if (!(await getConversationForUser(msg.conversation_id, user.id))) {
      return NextResponse.json({ message: "Xabar topilmadi" }, { status: 404 });
    }
    if (msg.sender_id === user.id) return NextResponse.json({ message: "O'z xabaringizga shikoyat qila olmaysiz" }, { status: 400 });

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabaseAdmin.from("chat_reports").select("id", { count: "exact", head: true }).eq("reporter_id", user.id).gte("created_at", since);
    if ((count || 0) >= DAILY_LIMIT) return NextResponse.json({ message: "Bugun juda ko'p shikoyat yubordingiz. Ertaga urinib ko'ring" }, { status: 429 });

    const { error } = await supabaseAdmin.from("chat_reports").insert({
      message_id: msg.id, group_id: msg.group_id, conversation_id: msg.conversation_id, reporter_id: user.id, reported_user_id: msg.sender_id,
      reason, note, snapshot: { type: msg.type, content: msg.content, media_url: msg.media_url, thumb_url: msg.thumb_url, sent_at: msg.created_at },
    });
    if (error) {
      if ((error as any).code === "23505") return NextResponse.json({ message: "Siz bu xabarga allaqachon shikoyat qilgansiz" }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Report POST:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
