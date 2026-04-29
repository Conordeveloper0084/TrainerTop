import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } });
}

// GET /api/posts
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select(`*, profiles:trainer_id (id, full_name, avatar_url, role)`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    let result = (posts || []).map((p: any) => ({ ...p, user_id: p.trainer_id }));

    if (user) {
      const { data: likes } = await supabaseAdmin.from("post_likes").select("post_id").eq("user_id", user.id);
      const likedIds = new Set((likes || []).map((l: any) => l.post_id));
      result = result.map((p: any) => ({ ...p, is_liked: likedIds.has(p.id) }));
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Posts GET:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST /api/posts
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { caption, images } = await request.json();

    // Faqat schema'dagi ustunlar
    const { data, error } = await supabaseAdmin
      .from("posts")
      .insert({
        trainer_id: user.id,
        caption: caption || null,
        images: images || [],
        likes_count: 0,
        comments_count: 0,
      })
      .select(`*, profiles:trainer_id (id, full_name, avatar_url, role)`)
      .single();

    if (error) { console.error("Post create:", error); throw error; }
    return NextResponse.json({ ...data, user_id: data.trainer_id });
  } catch (error: any) {
    console.error("Posts POST:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
