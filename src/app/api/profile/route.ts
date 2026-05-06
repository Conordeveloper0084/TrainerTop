import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/profile — O'z profilini olish
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ message: "Profil topilmadi" }, { status: 404 });
    }

    let extraProfile = null;
    if (profile.role === "trainer") {
      const { data } = await supabase
        .from("trainer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      extraProfile = data;
    } else {
      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      extraProfile = data;
    }

    // Agar trener bo'lsa — statistika
    let stats = null;
    if (profile.role === "trainer") {
      const { data: purchases } = await supabase
        .from("purchases")
        .select("amount, commission, trainer_amount")
        .eq("trainer_id", user.id)
        .eq("status", "paid");

      const totalEarnings = (purchases || []).reduce(
        (sum, p) => sum + p.trainer_amount,
        0
      );
      const totalSales = (purchases || []).length;

      stats = { totalEarnings, totalSales };
    }

    return NextResponse.json({
      ...profile,
      extra_profile: extraProfile,
      stats,
    });
  } catch (error) {
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// PUT /api/profile — Profilni yangilash
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, phone, avatar_url, trainer_data, user_data } = body;

    // Asosiy profil yangilash
    if (full_name || phone || avatar_url !== undefined) {
      const updates: any = {};
      if (full_name) updates.full_name = full_name;
      if (phone) updates.phone = phone;
      if (avatar_url !== undefined) updates.avatar_url = avatar_url;

      await supabaseAdmin.from("profiles").update(updates).eq("id", user.id);
    }

    // Trener profil yangilash
    if (trainer_data) {
      const { error } = await supabaseAdmin
        .from("trainer_profiles")
        .update({
          ...trainer_data,
          is_published: true,
        })
        .eq("user_id", user.id);

      if (error) {
        console.error("Trainer profile update error:", error);
        return NextResponse.json({ message: error.message }, { status: 500 });
      }
    }

    // Foydalanuvchi profil yangilash
    if (user_data) {
      await supabase
        .from("user_profiles")
        .update(user_data)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ message: "Profil yangilandi" });
  } catch (error) {
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
