import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getConversationForUser, getGroupAccess, softDeleteMessage } from "@/lib/chat";
import { UUID_RE } from "@/lib/db-errors";

// DELETE /api/chat/messages/[id] — xabarni hamma uchun o'chirish (yumshoq: qator qoladi, matn va fayl tozalanadi).
// Kim o'chira oladi: xabar egasi; guruhda — guruh admini (trener) ham shogirdlar xabarini o'chira oladi.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Xabar topilmadi" }, { status: 404 });

    const { data: msg } = await supabaseAdmin.from("messages")
      .select("id, sender_id, conversation_id, group_id, media_url, thumb_url, deleted_at").eq("id", params.id).maybeSingle();
    if (!msg) return NextResponse.json({ message: "Xabar topilmadi" }, { status: 404 });

    if (msg.group_id) {
      const access = await getGroupAccess(msg.group_id, user.id);
      if (access === "none" || access === "expired" || access === "removed") return NextResponse.json({ message: "Xabar topilmadi" }, { status: 404 });
      if (!(access === "owner" || msg.sender_id === user.id)) return NextResponse.json({ message: "Bu xabarni o'chirishga ruxsat yo'q" }, { status: 403 });
    } else {
      const conv = await getConversationForUser(msg.conversation_id, user.id);
      if (!conv) return NextResponse.json({ message: "Xabar topilmadi" }, { status: 404 });
      if (msg.sender_id !== user.id) return NextResponse.json({ message: "Bu xabarni o'chirishga ruxsat yo'q" }, { status: 403 });
    }

    if (msg.deleted_at) return NextResponse.json({ success: true, id: msg.id });
    await softDeleteMessage(msg, user.id);
    return NextResponse.json({ success: true, id: msg.id });
  } catch (error: any) {
    console.error("Message DELETE:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
