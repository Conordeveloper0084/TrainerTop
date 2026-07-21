import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/admin/sales — oxirgi sotuvlar
export async function GET(request: NextRequest) {
  try {
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
