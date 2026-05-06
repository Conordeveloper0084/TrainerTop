import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

// POST /api/posts/[id]/like — toggle like
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
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
