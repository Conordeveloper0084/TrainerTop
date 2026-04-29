import { NextResponse } from "next/server";
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

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin") return null;
  return user;
}

// GET /api/admin/stats
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    // Statistika
    const [usersRes, trainersRes, lessonsRes, postsRes, payoutsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user"),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "trainer"),
      supabaseAdmin.from("lessons").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("posts").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("payouts").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    // Jami balans va daromad
    const { data: balances } = await supabaseAdmin.from("trainer_profiles").select("balance, total_earned");
    const totalBalance = (balances || []).reduce((s: number, t: any) => s + (t.balance || 0), 0);
    const totalEarned = (balances || []).reduce((s: number, t: any) => s + (t.total_earned || 0), 0);

    return NextResponse.json({
      users: usersRes.count || 0,
      trainers: trainersRes.count || 0,
      lessons: lessonsRes.count || 0,
      posts: postsRes.count || 0,
      pending_payouts: payoutsRes.count || 0,
      total_balance: totalBalance,
      total_earned: totalEarned,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
