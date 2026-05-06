import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/lessons/[id]/reviews
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data } = await supabaseAdmin
      .from("reviews")
      .select("*, user:user_id(full_name, avatar_url)")
      .eq("lesson_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/lessons/[id]/reviews
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { rating, comment } = await request.json();
    if (!rating || rating < 1 || rating > 5) return NextResponse.json({ message: "1-5 reyting kerak" }, { status: 400 });

    // Darslik ma'lumotlarini olish (trainer_id kerak)
    const { data: lesson } = await supabaseAdmin
      .from("lessons")
      .select("trainer_id")
      .eq("id", params.id)
      .single();

    if (!lesson) return NextResponse.json({ message: "Darslik topilmadi" }, { status: 404 });
    if (lesson.trainer_id === user.id) return NextResponse.json({ message: "O'z darsligingizga sharh yoza olmaysiz" }, { status: 400 });

    // Allaqachon sharh yozganmi tekshirish
    const { data: existing } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("lesson_id", params.id)
      .eq("user_id", user.id)
      .single();

    if (existing) return NextResponse.json({ message: "Siz allaqachon sharh yozgansiz" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("reviews")
      .insert({
        lesson_id: params.id,
        trainer_id: lesson.trainer_id,
        user_id: user.id,
        rating,
        comment: comment?.trim() || null,
      })
      .select("*, user:user_id(full_name, avatar_url)")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
