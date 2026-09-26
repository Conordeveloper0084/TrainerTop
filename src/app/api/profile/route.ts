import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { NextRequest, NextResponse } from "next/server";

// GET /api/profile — O'z profilini olish (cookie yoki Bearer token)
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);

    if (!user) {
      return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ message: "Profil topilmadi" }, { status: 404 });
    }

    let extraProfile = null;
    if (profile.role === "trainer") {
      const { data } = await supabaseAdmin
        .from("trainer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      extraProfile = data;
    } else {
      const { data } = await supabaseAdmin
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      extraProfile = data;
    }

    // Agar trener bo'lsa — statistika
    let stats = null;
    if (profile.role === "trainer") {
      const { data: purchases } = await supabaseAdmin
        .from("purchases")
        .select("amount, commission, trainer_amount")
        .eq("trainer_id", user.id)
        .eq("status", "paid");

      const totalEarnings = (purchases || []).reduce(
        (sum, p) => sum + (p.trainer_amount || 0),
        0
      );
      const totalSales = (purchases || []).length;

      stats = { totalEarnings, totalSales };
    }

    return NextResponse.json({
      ...profile,
      extra_profile: extraProfile,
      trainer_profile: profile.role === "trainer" ? extraProfile : null,
      stats,
    });
  } catch (error) {
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

const TRAINER_EDITABLE = [
  "bio", "age", "gender", "experience_years", "specializations", "work_type", "city",
  "gym_name", "gym_address", "gym_photos", "location_lat", "location_lng",
  "monthly_price", "consultation_price", "manual_students",
] as const;
const USER_EDITABLE = ["age", "gender", "goal", "experience_level", "interests"] as const;

function pickAllowed(src: Record<string, any>, allowed: readonly string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of allowed) if (k in src) out[k] = src[k];
  return out;
}

// PUT /api/profile — Profilni yangilash (cookie yoki Bearer token)
export async function PUT(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);

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

    // Trener profil yangilash — FAQAT ruxsat etilgan maydonlar.
    // (balance, rating, komissiya, nishon kabi maydonlar bu yerdan HECH QACHON o'zgarmaydi)
    if (trainer_data && typeof trainer_data === "object") {
      const updates = pickAllowed(trainer_data, TRAINER_EDITABLE);
      if ("manual_students" in updates) {
        const n = Number(updates.manual_students);
        updates.manual_students = Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : 0;
      }
      const { error } = await supabaseAdmin
        .from("trainer_profiles")
        .update({ ...updates, is_published: true })
        .eq("user_id", user.id);

      if (error) {
        console.error("Trainer profile update error:", error);
        return NextResponse.json({ message: error.message }, { status: 500 });
      }
    }

    // Foydalanuvchi profil yangilash
    if (user_data && typeof user_data === "object") {
      await supabaseAdmin
        .from("user_profiles")
        .update(pickAllowed(user_data, USER_EDITABLE))
        .eq("user_id", user.id);
    }

    return NextResponse.json({ message: "Profil yangilandi" });
  } catch (error) {
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
