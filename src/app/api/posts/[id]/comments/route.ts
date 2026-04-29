import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/posts/[id]/comments
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabaseAdmin
      .from("post_comments")
      .select(`*, profiles:user_id (id, full_name, avatar_url)`)
      .eq("post_id", params.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST /api/posts/[id]/comments
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { content } = await request.json();
    const { data, error } = await supabaseAdmin
      .from("post_comments")
      .insert({ post_id: params.id, user_id: user.id, content })
      .select(`*, profiles:user_id (id, full_name, avatar_url)`)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
