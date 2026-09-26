import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

// GET /api/admin/payouts — barcha pul yechish so'rovlari
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";

    let query = supabaseAdmin
      .from("payouts")
      .select(`*, trainer:trainer_id (id, full_name, email, avatar_url)`)
      .order("requested_at", { ascending: false })
      .limit(200);

    if (["pending", "completed", "rejected"].includes(status)) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Admin payouts GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
