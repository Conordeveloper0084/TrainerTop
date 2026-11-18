import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { sanitizeSearch } from "@/lib/search";

// GET /api/admin/lessons?scope=all|platform|trainers|removed&q=
// Admin HAMMA darsliklarni ko'ra oladi (platforma va trenerlarniki). Ro'yxatda `content` yuborilmaydi —
// faqat bo'lim/video soni (og'ir ma'lumot yuklanmasligi uchun).
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const sp = new URL(request.url).searchParams;
    const scope = sp.get("scope") || "all";
    const q = sanitizeSearch(sp.get("q"));

    let query = supabaseAdmin
      .from("lessons")
      .select("*, profiles:trainer_id (id, full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(300);

    if (scope === "removed") query = query.eq("status", "removed");
    else query = query.neq("status", "removed");
    if (scope === "platform") query = query.eq("is_platform", true);
    if (scope === "trainers") query = query.or("is_platform.is.null,is_platform.eq.false");
    if (q) query = query.ilike("title", `%${q}%`);

    const { data, error } = await query;
    if (error) throw error;

    const result = (data || []).map(({ content, ...rest }: any) => {
      const sections: any[] = Array.isArray(content?.sections) ? content.sections : [];
      return {
        ...rest,
        sections_count: sections.length,
        videos_count: sections.reduce((n, s) => n + (Array.isArray(s?.videos) ? s.videos.length : 0), 0),
      };
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Admin lessons GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// POST /api/admin/lessons — platforma darsligi yaratish
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const body = await request.json();
    const { title, description, price, pricing_model, price_lifetime, price_monthly, category, difficulty, cover_url, sections, status } = body;
    if (!title?.trim()) return NextResponse.json({ message: "Nom kerak" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("lessons")
      .insert({
        trainer_id: admin.id,
        is_platform: true,
        title: title.trim(),
        description: description || null,
        price: parseInt(price) || parseInt(price_lifetime) || parseInt(price_monthly) || 0,
        pricing_model: pricing_model || "lifetime",
        price_lifetime: parseInt(price_lifetime) || 0,
        price_monthly: parseInt(price_monthly) || 0,
        category: category || null,
        difficulty: difficulty || "beginner",
        cover_image_url: cover_url || null,
        content: sections ? { sections } : [],
        status: status === "published" ? "published" : "draft",
      })
      .select("*")
      .single();
    if (error) { console.error("Admin lesson create error:", error); throw error; }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Admin lessons POST:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
