import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { softDeleteMessage } from "@/lib/chat";
import { UUID_RE } from "@/lib/db-errors";

// DELETE /api/admin/messages/[id] — admin istalgan chat xabarini o'chiradi (moderatsiya). Fayl ham o'chadi.
// Shu xabarga tegishli ochiq shikoyatlar "chora ko'rildi" deb belgilanadi.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Xabar topilmadi" }, { status: 404 });
    const { data: msg } = await supabaseAdmin.from("messages").select("id, group_id, conversation_id, media_url, thumb_url, deleted_at").eq("id", params.id).maybeSingle();
    if (!msg) return NextResponse.json({ message: "Xabar topilmadi" }, { status: 404 });
    if (!msg.deleted_at) await softDeleteMessage(msg, admin.id);
    await supabaseAdmin.from("chat_reports").update({ status: "actioned", handled_by: admin.id, handled_at: new Date().toISOString() }).eq("message_id", params.id).eq("status", "open");
    await logAdmin(admin.id, "message_delete", "message", params.id, { group_id: msg.group_id ?? null });
    return NextResponse.json({ success: true, id: msg.id });
  } catch (error: any) {
    console.error("Admin message DELETE:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
