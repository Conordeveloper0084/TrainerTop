import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { UUID_RE } from "@/lib/db-errors";

// PATCH /api/admin/content-reports/[id] — "ko'rildi" deb belgilash (reviewed_at o'rnatiladi)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });

    const { data, error } = await supabaseAdmin.from("reports").update({ reviewed_at: new Date().toISOString() }).eq("id", params.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Admin content-report PATCH:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
