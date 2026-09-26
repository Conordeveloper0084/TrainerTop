import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

// GET /api/admin/sales — oxirgi sotuvlar (FAQAT admin)
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const { data } = await supabaseAdmin
      .from("purchases")
      .select("*, lesson:lesson_id(title, category), buyer:user_id(full_name, email), trainer:trainer_id(full_name)")
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json([], { status: 200 });
  }
}
