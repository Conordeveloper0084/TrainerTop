import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { UUID_RE } from "@/lib/db-errors";

const ERRORS: Record<string, [number, string]> = {
  FORBIDDEN: [403, "Ruxsat yo'q"],
  NOT_FEATURED: [400, "Ikkalasi ham 'Top trenerlar' ro'yxatida bo'lishi kerak"],
};

// POST /api/admin/trainers/featured-reorder — { trainer_a, trainer_b }: ikkitasining tartibini almashtiradi
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const a = body?.trainer_a; const b = body?.trainer_b;
    if (typeof a !== "string" || !UUID_RE.test(a) || typeof b !== "string" || !UUID_RE.test(b)) {
      return NextResponse.json({ message: "Trenerlar noto'g'ri" }, { status: 400 });
    }
    const { error } = await supabaseAdmin.rpc("reorder_featured_trainers", { p_admin: admin.id, p_trainer_a: a, p_trainer_b: b });
    if (error) {
      const key = Object.keys(ERRORS).find((k) => String(error.message || "").includes(k));
      if (key) return NextResponse.json({ message: ERRORS[key][1] }, { status: ERRORS[key][0] });
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Featured reorder:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
