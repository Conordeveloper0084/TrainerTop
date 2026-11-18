import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { UUID_RE } from "@/lib/db-errors";

// PATCH /api/admin/reports/[id] — { status: "dismissed" | "actioned" | "open", note? }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Shikoyat topilmadi" }, { status: 404 });
    const { status, note } = await request.json().catch(() => ({}));
    if (!["dismissed", "actioned", "open"].includes(status)) return NextResponse.json({ message: "Noto'g'ri holat" }, { status: 400 });
    const text = typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : null;
    const updates = status === "open" ? { status, handled_by: null, handled_at: null, handled_note: null } : { status, handled_by: admin.id, handled_at: new Date().toISOString(), handled_note: text };
    const { data, error } = await supabaseAdmin.from("chat_reports").update(updates).eq("id", params.id).select("id, status").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "Shikoyat topilmadi" }, { status: 404 });
    await logAdmin(admin.id, `report_${status}`, "chat_report", params.id, {});
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Admin report PATCH:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
