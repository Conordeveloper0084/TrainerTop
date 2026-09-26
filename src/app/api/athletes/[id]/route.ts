import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getBannedUserIds } from "@/lib/bans";
import { UUID_RE } from "@/lib/db-errors";

// GET /api/athletes/[id] — atletning ochiq profili: ism, rasm, nishon, obunachilar, postlar.
// Email/telefon CHIQMAYDI. Trener bo'lsa { role: "trainer" } (sahifa trener profiliga yo'naltiradi). Banlangan/admin/yo'q → 404.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Profil topilmadi" }, { status: 404 });
    const [{ user }, banned] = await Promise.all([getApiUser(request), getBannedUserIds()]);
    if (banned.includes(params.id)) return NextResponse.json({ message: "Profil topilmadi" }, { status: 404 });

    const { data: p } = await supabaseAdmin.from("profiles").select("id, full_name, avatar_url, username, role, followers_count, athlete_badge, created_at").eq("id", params.id).maybeSingle();
    if (!p || !["user", "trainer"].includes(p.role)) return NextResponse.json({ message: "Profil topilmadi" }, { status: 404 });
    if (p.role === "trainer") return NextResponse.json({ role: "trainer", id: p.id });

    const [{ data: posts, count }, follow] = await Promise.all([
      supabaseAdmin.from("posts").select("id, caption, images, video_url, video_thumbnail_url, video_duration, likes_count, comments_count, created_at", { count: "exact" })
        .eq("trainer_id", params.id).order("created_at", { ascending: false }).limit(30),
      user && user.id !== params.id ? supabaseAdmin.from("follows").select("id").eq("follower_id", user.id).eq("trainer_id", params.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return NextResponse.json({
      role: "user", id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, username: p.username, athlete_badge: !!p.athlete_badge, joined_at: p.created_at,
      followers_count: Number(p.followers_count) || 0, posts_count: count || 0, posts: posts || [],
      is_following: !!(follow as any).data, is_own: user?.id === params.id,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Athlete GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
