import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } }
  );
}

// GET /api/lessons
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "";
    const difficulty = searchParams.get("difficulty") || "";
    const trainer_id = searchParams.get("trainer_id") || "";

    let query = supabaseAdmin
      .from("lessons")
      .select(`*, profiles:trainer_id (id, full_name, avatar_url)`)
      .order("created_at", { ascending: false });

    // trainer_id filter bo'lsa — draft ham ko'rinadi (o'z darsliklarim)
    if (trainer_id) {
      query = query.eq("trainer_id", trainer_id);
    } else {
      query = query.eq("status", "published");
    }

    if (category) query = query.eq("category", category);
    if (difficulty) query = query.eq("difficulty", difficulty);

    const { data, error } = await query;
    if (error) { console.error("Lessons GET error:", error); throw error; }
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST /api/lessons — darslik yaratish
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json();
    const { title, description, price, pricing_model, price_lifetime, price_monthly, category, difficulty, cover_url, sections, status } = body;

    if (!title?.trim()) return NextResponse.json({ message: "Nom kerak" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("lessons")
      .insert({
        trainer_id: user.id,
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
      .select(`*, profiles:trainer_id (id, full_name, avatar_url)`)
      .single();

    if (error) { console.error("Lesson create error:", error); throw error; }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
