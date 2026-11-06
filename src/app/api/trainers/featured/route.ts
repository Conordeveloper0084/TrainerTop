import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicTrainer } from "@/lib/public-fields";
import { getBannedUserIds, notInList } from "@/lib/bans";

// GET /api/trainers/featured — OCHIQ: admin bosh sahifa uchun tanlagan trenerlar (tartib bo'yicha).
// Bekor qilingan/nashr etilmagan/banlangan trener avtomatik chiqarib tashlanadi (admin ro'yxatdan
// olib tashlamagan bo'lsa ham). Bo'sh bo'lsa front-end o'zi namunaviy (mock) kartochkalarni ko'rsatadi.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("trainer_profiles")
      .select(`*, profiles:user_id (id, full_name, avatar_url, username)`)
      .eq("is_featured_home", true)
      .eq("is_published", true)
      .order("featured_order", { ascending: true });
    if (error) throw error;

    let trainers = data || [];
    const banned = await getBannedUserIds();
    if (banned.length > 0) trainers = trainers.filter((t: any) => !banned.includes(t.user_id));

    return NextResponse.json(
      trainers.map((t: any) => publicTrainer(t, ["id", "full_name", "avatar_url", "username"])),
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (error: any) {
    console.error("Featured trainers GET:", error);
    return NextResponse.json([]);
  }
}
