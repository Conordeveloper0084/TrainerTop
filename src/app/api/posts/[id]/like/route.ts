import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

// POST /api/posts/[id]/like — toggle like
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    // Like bormi tekshirish
    const { data: existing } = await supabaseAdmin
      .from("post_likes")
      .select("id")
      .eq("post_id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();

    // Sanoq DB trigger orqali yangilanadi (post_likes INSERT/DELETE) — yangi qiymat javobga ham qo'shiladi
    // (ilova "likes_count" ni qayta so'ramasdan yangilay oladi). Eski mijozlar `liked` ni o'qiyveradi.
    const currentCount = async () => {
      const { data } = await supabaseAdmin.from("posts").select("likes_count").eq("id", params.id).maybeSingle();
      const c = (data as any)?.likes_count;
      return typeof c === "number" && Number.isFinite(c) ? c : 0;
    };
    if (existing) {
      // Unlike
      await supabaseAdmin.from("post_likes").delete().eq("id", existing.id);
      return NextResponse.json({ liked: false, likes_count: await currentCount() });
    } else {
      // Like
      await supabaseAdmin.from("post_likes").insert({ post_id: params.id, user_id: user.id });
      return NextResponse.json({ liked: true, likes_count: await currentCount() });
    }
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
