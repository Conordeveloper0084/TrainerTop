import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

// POST /api/follows — toggle follow
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
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
