import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { isAdminId } from "@/lib/supabase/require-admin";
import { UUID_RE } from "@/lib/db-errors";

// DELETE /api/announcements/[id]/comments/[commentId] — o'z izohini yoki (admin bo'lsa) istalgan izohni o'chiradi
export async function DELETE(request: NextRequest, { params }: { params: { id: string; commentId: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    if (!UUID_RE.test(params.commentId)) return NextResponse.json({ message: "Izoh topilmadi" }, { status: 404 });

    const { data: comment } = await supabaseAdmin.from("announcement_comments").select("id, user_id, announcement_id, deleted_at").eq("id", params.commentId).maybeSingle();
    if (!comment || comment.deleted_at || comment.announcement_id !== params.id) return NextResponse.json({ message: "Izoh topilmadi" }, { status: 404 });

    const admin = comment.user_id !== user.id && (await isAdminId(user.id));
    if (comment.user_id !== user.id && !admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const { error } = await supabaseAdmin.from("announcement_comments").update({ deleted_at: new Date().toISOString(), deleted_by: user.id }).eq("id", params.commentId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Announcement comment DELETE:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
