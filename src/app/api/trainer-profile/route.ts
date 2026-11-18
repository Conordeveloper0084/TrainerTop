import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

// GET /api/trainer-profile — o'z trener ma'lumotlari (balans, sotuv soni, komissiya) — cookie yoki Bearer
// Karta ma'lumotlari endi saqlanmaydi: har pul yechishda kiritiladi.
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { data: tp } = await supabaseAdmin.from("trainer_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (!tp) return NextResponse.json({ message: "Trener profili topilmadi" }, { status: 404 });

    const { data: lessons } = await supabaseAdmin
      .from("lessons")
      .select("id, total_sales")
      .eq("trainer_id", user.id)
      .neq("status", "removed");

    const { data: def } = await supabaseAdmin.from("platform_settings").select("value").eq("key", "default_commission_percent").maybeSingle();
    const { card_number: _cn, card_holder: _ch, ...safe } = tp as any;

    return NextResponse.json({
      ...safe,
      effective_commission: tp.commission_rate ?? Number(def?.value ?? 10),
      total_lessons_sold: (lessons || []).reduce((sum: number, l: any) => sum + (l.total_sales || 0), 0),
      lessons_count: (lessons || []).length,
    });
  } catch (error: any) {
    console.error("trainer-profile:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
