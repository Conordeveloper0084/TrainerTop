import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { moderateMember } from "@/lib/moderation";
import { UUID_RE } from "@/lib/db-errors";

// PATCH /api/admin/groups/[id]/members/[userId] — ADMIN a'zoga chora ko'radi (trener bilan bir xil shakl).
// Admin qo'ygan chorani faqat admin o'zgartira oladi.
export async function PATCH(request: NextRequest, { params }: { params: { id: string; userId: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id) || !UUID_RE.test(params.userId)) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const r = await moderateMember({ groupId: params.id, target: params.userId, actorId: admin.id, actorIsAdmin: true, body });
    if (r.ok === false) return NextResponse.json({ message: r.message }, { status: r.status });
    await logAdmin(admin.id, `group_member_${body.action}`, "chat_group", params.id, { user_id: params.userId, reason: body.reason ?? null });
    return NextResponse.json({ success: true, ...r.data });
  } catch (error: any) {
    console.error("Admin member moderation:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
