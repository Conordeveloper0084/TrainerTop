import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/trainers — trenerlar ro'yxati
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const spec = searchParams.get("specialization") || "";
    const city = searchParams.get("city") || "";
    const workType = searchParams.get("work_type") || "";

    // Trainer profillar olish
    let query = supabaseAdmin
      .from("trainer_profiles")
      .select(`*, profiles:user_id (id, full_name, avatar_url, email)`)
      .eq("is_published", true)
      .order("rating", { ascending: false });

    if (city) query = query.eq("city", city);
    if (workType) query = query.eq("work_type", workType);
    if (spec) query = query.contains("specializations", [spec]);

    const { data, error } = await query;
    if (error) throw error;

    let trainers = data || [];

    // Search filter (ism bo'yicha)
    if (search) {
      const s = search.toLowerCase();
      trainers = trainers.filter((t: any) =>
        t.profiles?.full_name?.toLowerCase().includes(s) ||
        t.bio?.toLowerCase().includes(s)
      );
    }

    return NextResponse.json(trainers);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
