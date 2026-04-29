import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

// POST /api/follows — toggle follow
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { trainer_id } = await request.json();

    const { data: existing } = await supabaseAdmin
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("trainer_id", trainer_id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from("follows").delete().eq("id", existing.id);
      return NextResponse.json({ following: false });
    } else {
      await supabaseAdmin.from("follows").insert({ follower_id: user.id, trainer_id });
      return NextResponse.json({ following: true });
    }
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
