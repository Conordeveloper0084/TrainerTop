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

    if (existing) {
      // Unlike
      await supabaseAdmin.from("post_likes").delete().eq("id", existing.id);
      return NextResponse.json({ liked: false });
    } else {
      // Like
      await supabaseAdmin.from("post_likes").insert({ post_id: params.id, user_id: user.id });
      return NextResponse.json({ liked: true });
    }
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
