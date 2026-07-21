import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function requireAdmin() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return user;
}

// GET /api/admin/lessons — platforma darsliklari ro'yxati (admin uchun)
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("lessons")
      .select("*")
      .eq("is_platform", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST /api/admin/lessons — platforma darsligi yaratish
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const body = await request.json();
    const { title, description, price, pricing_model, price_lifetime, price_monthly, category, difficulty, cover_url, sections, status } = body;
    if (!title?.trim()) return NextResponse.json({ message: "Nom kerak" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("lessons")
      .insert({
        trainer_id: admin.id,
        is_platform: true,
        title: title.trim(),
        description: description || null,
        price: parseInt(price) || parseInt(price_lifetime) || parseInt(price_monthly) || 0,
        pricing_model: pricing_model || "lifetime",
        price_lifetime: parseInt(price_lifetime) || 0,
        price_monthly: parseInt(price_monthly) || 0,
        category: category || null,
        difficulty: difficulty || "beginner",
        cover_image_url: cover_url || null,
        content: sections ? { sections } : [],
        status: status || "draft",
      })
      .select("*")
      .single();
    if (error) { console.error("Admin lesson create error:", error); throw error; }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
