import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getBannedUserIds, notInList } from "@/lib/bans";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { getUserRole, canUploadVideo, keyFromPublicUrl, keyBelongsToUser } from "@/lib/media";
import { VIDEO_POST_MAX_BYTES, VIDEO_POST_MAX_SECONDS, ATHLETE_POST_DAILY_LIMIT, ATHLETE_VIDEO_DAILY_LIMIT } from "@/lib/constants";

// GET /api/posts
export async function GET(request: NextRequest) {
  try {
    // Mustaqil narsalar BIR VAQTDA: foydalanuvchini aniqlash va ban ro'yxati
    const [{ user }, banned] = await Promise.all([getApiUser(request), getBannedUserIds()]);

    // Ban qilingan foydalanuvchilarning postlari lentada ko'rinmaydi
    const build = (extra: string) => {
      let q = supabaseAdmin
        .from("posts")
        .select(`*, profiles:trainer_id (id, full_name, avatar_url, role${extra})`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (banned.length > 0) q = q.not("trainer_id", "in", notInList(banned));
      return q;
    };
    // athlete_badge ustuni v18 da qo'shilgan: baza hali yangilanmagan bo'lsa ham lenta ishlashda davom etadi (nishonsiz)
    let { data: posts, error } = await build(", athlete_badge");
    if (error) ({ data: posts, error } = await build(""));

    if (error) throw error;

    const postIds = (posts || []).map((p: any) => p.id);
    const authorIds = Array.from(new Set((posts || []).map((p: any) => p.trainer_id).filter(Boolean)));

    // "TrainerTop Athlete" nishoni va joriy foydalanuvchining layklari — ikkalasi bir vaqtda so'raladi
    // (layklar faqat ko'rsatilayotgan postlar uchun: foydalanuvchi minglab layk qo'ygan bo'lsa ham yengil)
    const empty = Promise.resolve({ data: [] as any[] });
    const [vtRes, likesRes] = await Promise.all([
      authorIds.length > 0
        ? supabaseAdmin.from("trainer_profiles").select("user_id").in("user_id", authorIds).eq("is_verified", true)
        : empty,
      user && postIds.length > 0
        ? supabaseAdmin.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds)
        : empty,
    ]);

    // Nishon: trener — "TrainerTop Trener" (trainer_profiles.is_verified), atlet — "TrainerTop Athlete" (profiles.athlete_badge)
    const verified = new Set<string>((vtRes.data || []).map((r: any) => r.user_id));
    let result = (posts || []).map((p: any) => {
      const isTrainer = p.profiles?.role === "trainer" || verified.has(p.trainer_id);
      const has = verified.has(p.trainer_id) || (p.profiles?.role === "user" && !!p.profiles?.athlete_badge);
      const { athlete_badge: _omit, ...rest } = p.profiles || {};
      return { ...p, user_id: p.trainer_id, profiles: p.profiles ? { ...rest, is_verified: has, badge_kind: isTrainer ? "trainer" : "athlete" } : p.profiles };
    });

    if (user) {
      const likedIds = new Set((likesRes.data || []).map((l: any) => l.post_id));
      result = result.map((p: any) => ({ ...p, is_liked: likedIds.has(p.id) }));
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Posts GET:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST /api/posts
// Body: { caption?, images?: string[], video_url?, video_thumbnail_url?, video_duration? }
// Post rasmlardan YOKI bitta videodan iborat bo'ladi (ikkalasi birga emas).
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const caption = typeof body.caption === "string" ? body.caption.trim() : "";
    const images: string[] = Array.isArray(body.images) ? body.images : [];
    const videoUrl = body.video_url || null;
    const thumbUrl = body.video_thumbnail_url || null;

    if (caption.length > 2000) {
      return NextResponse.json({ message: "Matn juda uzun" }, { status: 400 });
    }
    if (images.length > 5 || images.some((u) => typeof u !== "string" || !/^https:\/\//.test(u) || u.length > 2048)) {
      return NextResponse.json({ message: "Rasmlar noto'g'ri (5 tagacha, https havola)" }, { status: 400 });
    }
    if (!caption && images.length === 0 && !videoUrl) {
      return NextResponse.json({ message: "Rasm, video yoki matn kerak" }, { status: 400 });
    }

    let videoDuration: number | null = null;

    // Oddiy foydalanuvchi (atlet) ham blog yuritadi — lekin kunlik chegara bilan (saqlash xarajati va spamdan himoya)
    const role = await getUserRole(user.id);
    if (role === "user") {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [{ count: total }, { count: videos }] = await Promise.all([
        supabaseAdmin.from("posts").select("id", { count: "exact", head: true }).eq("trainer_id", user.id).gte("created_at", since),
        videoUrl ? supabaseAdmin.from("posts").select("id", { count: "exact", head: true }).eq("trainer_id", user.id).not("video_url", "is", null).gte("created_at", since) : Promise.resolve({ count: 0 }),
      ]);
      if ((total || 0) >= ATHLETE_POST_DAILY_LIMIT) return NextResponse.json({ message: `Kuniga ${ATHLETE_POST_DAILY_LIMIT} tadan ko'p post joylab bo'lmaydi. Ertaga urinib ko'ring` }, { status: 429 });
      if (videoUrl && (videos || 0) >= ATHLETE_VIDEO_DAILY_LIMIT) return NextResponse.json({ message: `Kuniga ${ATHLETE_VIDEO_DAILY_LIMIT} tadan ko'p video joylab bo'lmaydi. Ertaga urinib ko'ring` }, { status: 429 });
    }

    if (videoUrl) {
      if (images.length > 0) {
        return NextResponse.json({ message: "Postda rasm va video birga bo'lmaydi" }, { status: 400 });
      }

      if (!canUploadVideo(role, "posts")) {
        return NextResponse.json({ message: "Video yuklashga ruxsat yo'q" }, { status: 403 });
      }

      // Video bizning R2'dagi, shu foydalanuvchining posts/ papkasidagi fayl bo'lishi shart
      const videoKey = keyFromPublicUrl(videoUrl);
      if (!videoKey || !videoKey.startsWith("posts/") || !keyBelongsToUser(videoKey, user.id)) {
        return NextResponse.json({ message: "Video havolasi noto'g'ri" }, { status: 400 });
      }
      if (thumbUrl) {
        const thumbKey = keyFromPublicUrl(thumbUrl);
        if (!thumbKey || !thumbKey.startsWith("posts/") || !keyBelongsToUser(thumbKey, user.id)) {
          return NextResponse.json({ message: "Video muqovasi noto'g'ri" }, { status: 400 });
        }
      }

      // Server tomonda haqiqiy hajm va turini tekshirish (klient yolg'on aytishi mumkin)
      try {
        const head = await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: videoKey }));
        if (!head.ContentType || !head.ContentType.startsWith("video/")) {
          return NextResponse.json({ message: "Fayl video emas" }, { status: 400 });
        }
        if ((head.ContentLength || 0) > VIDEO_POST_MAX_BYTES) {
          return NextResponse.json({ message: "Video juda katta" }, { status: 413 });
        }
      } catch {
        return NextResponse.json({ message: "Video topilmadi. Qayta yuklang" }, { status: 400 });
      }

      // Davomiylik klientdan keladi (serverda o'lchab bo'lmaydi) — faqat oralig'ini cheklaymiz
      const d = Math.round(Number(body.video_duration));
      videoDuration = Number.isFinite(d) && d >= 1 ? Math.min(d, VIDEO_POST_MAX_SECONDS) : null;
    }

    const row: Record<string, unknown> = {
      trainer_id: user.id,
      caption: caption || null,
      images,
      likes_count: 0,
      comments_count: 0,
    };
    // Video ustunlari faqat video post bo'lganda yoziladi
    // (migration-v11 hali ishga tushmagan bo'lsa ham oddiy rasmli postlar ishlayveradi)
    if (videoUrl) {
      row.video_url = videoUrl;
      row.video_thumbnail_url = thumbUrl;
      row.video_duration = videoDuration;
    }

    const { data, error } = await supabaseAdmin
      .from("posts")
      .insert(row)
      .select(`*, profiles:trainer_id (id, full_name, avatar_url, role)`)
      .single();

    if (error) { console.error("Post create:", error); throw error; }
    return NextResponse.json({ ...data, user_id: data.trainer_id });
  } catch (error: any) {
    console.error("Posts POST:", error);
    return NextResponse.json({ message: "Post yaratishda xatolik" }, { status: 500 });
  }
}
