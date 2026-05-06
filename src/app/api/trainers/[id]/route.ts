import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/trainers/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } }
    );
    const { data: { user } } = await supabase.auth.getUser();

    // Trainer profil
    const { data: tp, error } = await supabaseAdmin
      .from("trainer_profiles")
      .select(`*, profiles:user_id (id, full_name, avatar_url, email, created_at)`)
      .eq("user_id", params.id)
      .single();
    if (error) throw error;

    // Darsliklar
    const { data: lessons } = await supabaseAdmin
      .from("lessons")
      .select("*")
      .eq("trainer_id", params.id)
      .eq("status", "published");

    // Postlar
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("user_id", params.id)
      .order("created_at", { ascending: false });

    // Sharhlar
    const { data: reviews } = await supabaseAdmin
      .from("reviews")
      .select(`*, profiles:user_id (full_name, avatar_url)`)
      .eq("trainer_id", params.id)
      .order("created_at", { ascending: false });

    // Follow holati
    let isFollowing = false;
    if (user) {
      const { data: follow } = await supabaseAdmin
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("trainer_id", params.id)
        .maybeSingle();
      isFollowing = !!follow;
    }

    return NextResponse.json({
      ...tp,
      lessons: lessons || [],
      posts: posts || [],
      reviews: reviews || [],
      isFollowing,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
