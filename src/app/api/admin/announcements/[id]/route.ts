import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { UUID_RE } from "@/lib/db-errors";
import { editAnnouncement } from "@/lib/announcements-server";

// PATCH /api/admin/announcements/[id] — mavjud KANAL postini tahrirlash (matn/rasm/video/havola).
// Faqat kind='all' va lesson_id yo'q postlar (haqiqiy kanal postlari, boost yoki shaxsiy xabar emas).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const result = await editAnnouncement(admin.id, params.id, body);
    if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
    await logAdmin(admin.id, "announcement_edit", "announcement", params.id, {});
    return NextResponse.json({ success: true, edited_at: result.edited_at });
  } catch (error: any) {
    console.error("Admin announcement PATCH:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// DELETE /api/admin/announcements/[id] — e'lonni qaytarib olish (kanaldan hamma uchun yo'qoladi; tarixda "o'chirilgan" bo'lib qoladi)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "E'lon topilmadi" }, { status: 404 });
    const { data, error } = await supabaseAdmin.from("announcements")
      .update({ deleted_at: new Date().toISOString(), deleted_by: admin.id }).eq("id", params.id).is("deleted_at", null).select("id, kind").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "E'lon topilmadi yoki allaqachon o'chirilgan" }, { status: 404 });
    await logAdmin(admin.id, "announcement_delete", "announcement", params.id, { kind: data.kind });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Admin announcement DELETE:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
