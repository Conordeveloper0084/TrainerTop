import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

// GET /api/trainer/earnings — trenerning to'liq moliyaviy statistikasi (cookie yoki Bearer token)
// Javob: rate, balance, min_payout, lifetime{gross,commission,net,sales}, payouts{pending,paid,...},
//        adjustments, reconciled, lessons[], monthly[12], recent_sales[20]
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { data, error } = await supabaseAdmin.rpc("trainer_earnings", { p_trainer: user.id });
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "Bu bo'lim faqat trenerlar uchun" }, { status: 403 });

    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("Trainer earnings:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
