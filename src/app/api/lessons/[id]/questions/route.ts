import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/lessons/[id]/questions
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data } = await supabaseAdmin
      .from("lesson_questions")
      .select("*, user:user_id(full_name, avatar_url)")
      .eq("lesson_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/lessons/[id]/questions
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { question } = await request.json();
    if (!question?.trim()) return NextResponse.json({ message: "Savol yozing" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("lesson_questions")
      .insert({ lesson_id: params.id, user_id: user.id, question: question.trim() })
      .select("*, user:user_id(full_name, avatar_url)")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
