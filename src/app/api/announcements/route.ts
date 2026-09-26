import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { safeLink, ANNOUNCE_PAGE_SIZE } from "@/lib/announcements";

// GET /api/announcements?before=<ISO> — rasmiy TrainerTop kanali: hammaga e'lonlar + menga shaxsiy xabarlar (eskisi → yangisi).
// Boost qilingan darslik kartochkasi darslik ma'lumoti bilan keladi; darslik chop etilmagan/o'chirilgan yoki trener banlangan bo'lsa
// kartochka lentada yo'q (bu bazada tekshiriladi).
// Birinchi sahifa ochilganda kanal "o'qildi" deb belgilanadi (chat va qo'ng'iroqchadagi belgi yo'qoladi).
// Faqat ko'rsatishga kerakli maydonlar qaytadi (kim yuborgani, auditoriya, nishon id — YO'Q).
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const rawBefore = new URL(request.url).searchParams.get("before");
    const before = rawBefore && !Number.isNaN(Date.parse(rawBefore)) ? new Date(rawBefore).toISOString() : null;
    const { data, error } = await supabaseAdmin.rpc("announcement_feed", { p_user: user.id, p_before: before, p_limit: ANNOUNCE_PAGE_SIZE });
    if (error) throw error;

    if (!before) await supabaseAdmin.rpc("announcement_mark_read", { p_user: user.id });
    const items = (Array.isArray(data) ? data : []).map((a: any) => ({
      id: a.id, kind: a.kind, title: a.title ?? null, body: a.body ?? null, image_url: a.image_url ?? null,
      video_url: a.video_url ?? null, video_thumbnail_url: a.video_thumbnail_url ?? null, video_duration: a.video_duration ?? null,
      link_url: safeLink(a.link_url), link_label: a.link_label ?? null, created_at: a.created_at, edited_at: a.edited_at ?? null,
      views_count: Number(a.views_count) || 0, comments_count: Number(a.comments_count) || 0, lesson: a.lesson ?? null,
    }));
    return NextResponse.json(items, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Announcements GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
