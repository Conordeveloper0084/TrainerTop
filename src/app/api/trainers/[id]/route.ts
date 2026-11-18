import { NextRequest, NextResponse } from "next/server";
import { withCounts } from "@/lib/post-counts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getBannedUserIds } from "@/lib/bans";
import { getBlockedUserIds } from "@/lib/blocks";
import { isAdminId } from "@/lib/supabase/require-admin";
import { publicTrainer, pickFields } from "@/lib/public-fields";

// GET /api/trainers/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    const [banned, blocked] = await Promise.all([getBannedUserIds(), getBlockedUserIds(user?.id)]);
    const excluded = new Set([...banned, ...blocked]);

    // Ban qilingan foydalanuvchi profili faqat adminga ko'rinadi
    if (banned.includes(params.id) && !(user && (await isAdminId(user.id)))) {
      return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    }

    // Trainer profil (bo'lmasligi mumkin — oddiy user ham post qo'yadi)
    const { data: tp } = await supabaseAdmin
      .from("trainer_profiles")
      .select(`*, profiles:user_id (id, full_name, avatar_url, username, created_at)`)
      .eq("user_id", params.id)
      .maybeSingle();

    // Asosiy profil — har doim kerak (trener bo'lmasa ham)
    const { data: baseProfile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, avatar_url, username, role, created_at")
      .eq("id", params.id)
      .single();
    if (pErr) throw pErr;

    // Darsliklar (trener bo'lsa)
    const { data: lessons } = await supabaseAdmin
      .from("lessons")
      .select("*")
      .eq("trainer_id", params.id)
      .eq("status", "published"); // olib tashlangan (removed) darsliklar chiqmaydi

    // Postlar
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("trainer_id", params.id)
      .order("created_at", { ascending: false });

    // Sharhlar (banlangan foydalanuvchining sharhi ko'rsatilmaydi)
    const { data: reviews } = await supabaseAdmin
      .from("reviews")
      .select(`*, profiles:user_id (full_name, avatar_url)`)
      .eq("trainer_id", params.id)
      .order("created_at", { ascending: false });
    const visibleReviews = (reviews || []).filter((r: any) => !excluded.has(r.user_id));

    // Follow holati va shu trener postlariga qo'yilgan layklar (kirgan foydalanuvchi uchun) — bir vaqtda, har biri BITTA so'rov
    let isFollowing = false;
    let likedIds = new Set<string>();
    if (user) {
      const postIds = (posts || []).map((x: any) => x.id);
      const [{ data: follow }, likesRes] = await Promise.all([
        supabaseAdmin.from("follows").select("id").eq("follower_id", user.id).eq("trainer_id", params.id).maybeSingle(),
        postIds.length > 0
          ? supabaseAdmin.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      isFollowing = !!follow;
      likedIds = new Set(((likesRes as any).data || []).map((l: any) => l.post_id));
    }

    // tp (trainer_profiles) mavjudligi YETARLI EMAS — role='trainer' bo'lmasa (masalan,
    // akkaunt keyinchalik oddiy foydalanuvchiga aylantirilgan-u trainer_profiles tozalanmagan
    // bo'lsa), uni trener sifatida ko'rsatmaymiz.
    const isActuallyTrainer = !!tp && baseProfile.role === "trainer";

    // Trener profili bo'lsa uni, bo'lmasa oddiy profilni qaytaramiz
    return NextResponse.json({
      ...(isActuallyTrainer ? publicTrainer(tp, ["id", "full_name", "avatar_url", "username", "created_at"]) : {}),
      user_id: params.id,
      is_trainer: isActuallyTrainer,
      profiles: isActuallyTrainer && tp?.profiles
        ? pickFields(tp.profiles, ["id", "full_name", "avatar_url", "username", "created_at"])
        : baseProfile,
      // Darslik ro'yxatida pullik kontent (content) bo'lmaydi
      lessons: (lessons || []).map(({ content, ...rest }: any) => rest),
      // Postlar ham lentadagi kabi: user_id, va kirgan foydalanuvchiga is_liked / is_following (mehmonda bu maydonlar YO'Q)
      posts: (posts || []).map((x: any) => {
        const post = withCounts({ ...x, user_id: x.trainer_id });
        return user ? { ...post, is_liked: likedIds.has(x.id), is_following: isFollowing } : post;
      }),
      reviews: visibleReviews,
      isFollowing,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
