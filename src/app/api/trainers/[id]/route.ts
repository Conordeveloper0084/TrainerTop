import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

// GET /api/trainers/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);

    // Trainer profil (bo'lmasligi mumkin — oddiy user ham post qo'yadi)
    const { data: tp } = await supabaseAdmin
      .from("trainer_profiles")
      .select(`*, profiles:user_id (id, full_name, avatar_url, email, created_at)`)
      .eq("user_id", params.id)
      .maybeSingle();

    // Asosiy profil — har doim kerak (trener bo'lmasa ham)
    const { data: baseProfile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url, email, role, created_at")
      .eq("id", params.id)
      .single();
    if (pErr) throw pErr;

    // Darsliklar (trener bo'lsa)
    const { data: lessons } = await supabaseAdmin
      .from("lessons")
      .select("*")
      .eq("trainer_id", params.id)
      .eq("status", "published");

    // Postlar
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("trainer_id", params.id)
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

    // Trener profili bo'lsa uni, bo'lmasa oddiy profilni qaytaramiz
    return NextResponse.json({
      ...(tp || {}),
      user_id: params.id,
      is_trainer: !!tp,
      profiles: tp?.profiles || baseProfile,
      lessons: lessons || [],
      posts: posts || [],
      reviews: reviews || [],
      isFollowing,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
