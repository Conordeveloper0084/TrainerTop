import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/trainer-profile — o'z trener ma'lumotlari (balans, karta, sotuv soni)
export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    // Trainer profile
    const { data: tp } = await supabaseAdmin
      .from("trainer_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Sotilgan darsliklar soni va darsliklar ro'yxati
    const { data: lessons } = await supabaseAdmin
      .from("lessons")
      .select("id, total_sales")
      .eq("trainer_id", user.id);

    const totalLessonsSold = (lessons || []).reduce((sum: number, l: any) => sum + (l.total_sales || 0), 0);
    const lessonsCount = (lessons || []).length;

    return NextResponse.json({
      ...(tp || {}),
      total_lessons_sold: totalLessonsSold,
      lessons_count: lessonsCount,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
