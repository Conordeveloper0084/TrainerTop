import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicTrainer } from "@/lib/public-fields";
import { getBannedUserIds, notInList } from "@/lib/bans";

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
      .select(`*, profiles:user_id (id, full_name, avatar_url, username)`)
      .eq("is_published", true)
      .order("rating", { ascending: false });

    const banned = await getBannedUserIds();
    if (banned.length > 0) query = query.not("user_id", "in", notInList(banned));

    if (city) query = query.eq("city", city);
    if (workType) query = query.eq("work_type", workType);
    if (spec) query = query.contains("specializations", [spec]);

    const { data, error } = await query;
    if (error) throw error;

    let trainers = data || [];

    // Search filter (ism yoki @username bo'yicha)
    if (search) {
      const s = search.toLowerCase().replace(/^@/, "");
      trainers = trainers.filter((t: any) =>
        t.profiles?.full_name?.toLowerCase().includes(s) ||
        t.profiles?.username?.toLowerCase().includes(s) ||
        t.bio?.toLowerCase().includes(s)
      );
    }

    // Faqat ommaviy maydonlar (karta, balans, email chiqmaydi)
    return NextResponse.json(trainers.map((t: any) => publicTrainer(t, ["id", "full_name", "avatar_url", "username"])));
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
