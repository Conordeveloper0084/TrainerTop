import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function requireAdmin() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return user;
}

// GET /api/admin/trainers — trenerlar to'liq ma'lumot bilan
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    let query = supabaseAdmin
      .from("profiles")
      .select(`*, trainer_profile:trainer_profiles!trainer_profiles_user_id_fkey(*)`)
      .eq("role", "trainer")
      .order("created_at", { ascending: false });

    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data: trainers, error } = await query.limit(100);
    if (error) throw error;

    // Har bir trener uchun darslik soni
    const result = await Promise.all((trainers || []).map(async (t: any) => {
      const { count } = await supabaseAdmin
        .from("lessons")
        .select("*", { count: "exact", head: true })
        .eq("trainer_id", t.id);

      return {
        ...t,
        trainer_profile: Array.isArray(t.trainer_profile) ? t.trainer_profile[0] : t.trainer_profile,
        lessons_count: count || 0,
      };
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Admin trainers:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
