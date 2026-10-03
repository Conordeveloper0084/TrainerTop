import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { getBannedUserIds } from "@/lib/bans";

// GET /api/admin/stats
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const [usersRes, trainersRes, lessonsRes, postsRes, payoutsRes, finRes, banned] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user"),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "trainer"),
      supabaseAdmin.from("lessons").select("*", { count: "exact", head: true }).neq("status", "removed"),
      supabaseAdmin.from("posts").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("payouts").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.rpc("admin_finance_summary"),
      getBannedUserIds(),
    ]);
    if (finRes.error) throw finRes.error;
    const fin: any = finRes.data || {};

    return NextResponse.json({
      users: usersRes.count || 0,
      trainers: trainersRes.count || 0,
      lessons: lessonsRes.count || 0,
      posts: postsRes.count || 0,
      pending_payouts: payoutsRes.count || 0,
      banned_users: banned.length,
      // Moliya (hisob daftaridan): eski kalitlar saqlandi
      total_revenue: fin.gross || 0,
      total_commission: fin.commission || 0,
      total_earned: fin.to_trainers || 0,
      total_balance: fin.balances || 0,
      total_sales: fin.sales || 0,
      pending_payout_amount: fin.pending_payouts || 0,
      paid_out: fin.paid_out || 0,
      gross_30d: fin.gross_30d || 0,
      commission_30d: fin.commission_30d || 0,
      unreconciled: fin.unreconciled || 0,
    });
  } catch (error: any) {
    console.error("Admin stats:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
