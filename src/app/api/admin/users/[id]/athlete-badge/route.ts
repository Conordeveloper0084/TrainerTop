import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { UUID_RE } from "@/lib/db-errors";

const ERRORS: Record<string, [number, string]> = {
  FORBIDDEN: [403, "Ruxsat yo'q"], BAD_ACTION: [400, "Noto'g'ri amal"], USER_NOT_FOUND: [404, "Foydalanuvchi topilmadi"],
  NOT_ATHLETE: [400, "Atlet nishoni faqat oddiy foydalanuvchilar uchun (trenerlarga \"TrainerTop Trener\" nishoni beriladi)"],
  STATE_INVALID: [409, "Nishon holati allaqachon shunday"],
};

// POST /api/admin/users/[id]/athlete-badge — { action: "grant" | "revoke" } — atlet nishonini qo'lda berish/olib tashlash (audit bazada)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: ERRORS.USER_NOT_FOUND[1] }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const { data, error } = await supabaseAdmin.rpc("set_athlete_badge", { p_admin: admin.id, p_user: params.id, p_action: typeof body.action === "string" ? body.action : null });
    if (error) {
      const key = Object.keys(ERRORS).find((k) => String(error.message || "").includes(k));
      if (key) return NextResponse.json({ message: ERRORS[key][1] }, { status: ERRORS[key][0] });
      throw error;
    }
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error("Athlete badge:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
