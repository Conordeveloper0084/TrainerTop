import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getBannedUserIds } from "@/lib/bans";
import { UUID_RE } from "@/lib/db-errors";

// POST /api/follows — { trainer_id } (kuzatiladigan profil: trener YOKI atlet): obuna bo'lish / obunani bekor qilish (toggle)
// Javob: { following, followers_count }
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const target = body?.trainer_id;
    if (typeof target !== "string" || !UUID_RE.test(target)) return NextResponse.json({ message: "Profil topilmadi" }, { status: 404 });
    if (target === user.id) return NextResponse.json({ message: "O'zingizga obuna bo'lib bo'lmaydi" }, { status: 400 });

    const { data: profile } = await supabaseAdmin.from("profiles").select("id, role").eq("id", target).maybeSingle();
    if (!profile || !["trainer", "user"].includes(profile.role)) return NextResponse.json({ message: "Profil topilmadi" }, { status: 404 });

    const { data: existing } = await supabaseAdmin.from("follows").select("id").eq("follower_id", user.id).eq("trainer_id", target).maybeSingle();
    if (existing) {
      await supabaseAdmin.from("follows").delete().eq("id", existing.id);
    } else {
      // Banlangan profilga yangi obuna bo'lib bo'lmaydi (bekor qilish esa mumkin)
      if ((await getBannedUserIds()).includes(target)) return NextResponse.json({ message: "Profil topilmadi" }, { status: 404 });
      const { error } = await supabaseAdmin.from("follows").insert({ follower_id: user.id, trainer_id: target });
      if (error && (error as any).code !== "23505") throw error;
    }
    const { data: after } = await supabaseAdmin.from("profiles").select("followers_count").eq("id", target).maybeSingle();
    return NextResponse.json({ following: !existing, followers_count: Number(after?.followers_count) || 0 });
  } catch (error: any) {
    console.error("Follows POST:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
