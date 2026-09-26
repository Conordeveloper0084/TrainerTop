import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { UUID_RE } from "@/lib/db-errors";

const ERRORS: Record<string, [number, string]> = {
  FORBIDDEN: [403, "Ruxsat yo'q"], REVIEW_NOT_FOUND: [404, "Baho topilmadi"], BAD_ACTION: [400, "Noto'g'ri amal"],
  NEEDS_COMMENT: [400, "Faqat izohli bahoni bosh sahifada ko'rsatish mumkin"], HIDDEN: [409, "Yashirilgan bahoni ko'rsatib bo'lmaydi. Avval yashirinni oching"],
};

// PATCH /api/admin/platform-reviews/[userId] — { action: feature | unfeature | hide | unhide } (qoidalar bazada; audit ham bazada yoziladi)
export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.userId)) return NextResponse.json({ message: ERRORS.REVIEW_NOT_FOUND[1] }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const { data, error } = await supabaseAdmin.rpc("platform_review_moderate", { p_admin: admin.id, p_user: params.userId, p_action: typeof body.action === "string" ? body.action : null });
    if (error) {
      const key = Object.keys(ERRORS).find((k) => String(error.message || "").includes(k));
      if (key) return NextResponse.json({ message: ERRORS[key][1] }, { status: ERRORS[key][0] });
      throw error;
    }
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error("Admin platform review PATCH:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
