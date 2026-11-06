import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getBannedUserIds, notInList } from "@/lib/bans";
import { parsePageParams, buildPage } from "@/lib/pagination";
import { escapeLike } from "@/lib/search";
import { listResponseHeaders } from "@/lib/http-cache";

// GET /api/lessons — ?limit=&cursor= berilsa {items, next_cursor} (ilova uchun), berilmasa eski
// xatti-harakat (butun ro'yxat) saqlanadi. ?search=<matn> — darslik sarlavhasi (title) bo'yicha
// ilike qidiruv (\ % _ ekranlanadi); category/difficulty/limit/cursor bilan birga ishlaydi.
export async function GET(request: NextRequest) {
  const t0 = performance.now();
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "";
    const difficulty = searchParams.get("difficulty") || "";
    const trainer_id = searchParams.get("trainer_id") || "";
    const platform = searchParams.get("platform") || "";
    const purchased = searchParams.get("purchased") || "";
    const search = (searchParams.get("search") || "").trim().slice(0, 100);
    const page = parsePageParams(searchParams);

    // Ko'ruvchi KERAK FAQAT: o'z xaridlari (purchased=true) va trener o'z qoralamalarini ko'rishi
    // (trainer_id=...). Ochiq ro'yxat (katalog, platforma) hamma uchun bir xil — shuning uchun
    // login qilgan foydalanuvchida ham Supabase Auth'ga (+ban so'roviga) ortiqcha tarmoq so'rovi yuborilmaydi.
    const needsViewer = purchased === "true" || !!trainer_id;
    const { user } = needsViewer ? await getApiUser(request) : { user: null };
    // Foydalanuvchiga bog'liq bo'lmagan ochiq ro'yxat → CDN keshlanadi (docs/performance-latency-cdn.md)
    const cacheable = !needsViewer;

    const dbStart = performance.now();
    const banned = await getBannedUserIds();

    let query = supabaseAdmin
      .from("lessons")
      .select(`*, profiles:trainer_id (id, full_name, avatar_url)`)
      .neq("status", "removed")
      .order("created_at", { ascending: false });
    if (page.paginate) query = query.limit(page.limit + 1);

    // Ban qilingan trenerlarning darsliklari ommaviy ro'yxatlarda ko'rinmaydi
    if (banned.length > 0) {
      if (trainer_id && banned.includes(trainer_id)) return NextResponse.json(page.paginate ? { items: [], next_cursor: null } : []);
      query = query.not("trainer_id", "in", notInList(banned));
    }

    // purchased=true — shu foydalanuvchi SOTIB OLGAN darsliklar ("Video darsliklar" bo'limi).
    // Status (draft bo'lsa ham) cheklanmaydi — trener darslikni keyinroq yashirsa/o'chirsa ham,
    // xarid qilgan odam kirishda davom etishi kerak (xuddi o'z-o'zini o'chirish siyosatidagi kabi).
    if (purchased === "true") {
      if (!user) return NextResponse.json(page.paginate ? { items: [], next_cursor: null } : []);
      const { data: purchaseRows, error: pErr } = await supabaseAdmin
        .from("purchases").select("lesson_id, purchase_type, expires_at")
        .eq("user_id", user.id).eq("status", "paid");
      if (pErr) throw pErr;
      const now = Date.now();
      const validIds = Array.from(new Set((purchaseRows || [])
        .filter((p: any) => !(p.purchase_type === "monthly" && p.expires_at && new Date(p.expires_at).getTime() <= now))
        .map((p: any) => p.lesson_id)));
      if (validIds.length === 0) return NextResponse.json(page.paginate ? { items: [], next_cursor: null } : []);
      query = query.in("id", validIds);
    } else if (platform === "true") {
      // platform=true — faqat platforma (admin) darsliklari
      query = query.eq("is_platform", true).eq("status", "published");
    } else if (trainer_id) {
      // Draft'lar faqat darslik egasiga ko'rinadi; boshqalarga faqat e'lon qilinganlari
      query = query.eq("trainer_id", trainer_id);
      if (!user || user.id !== trainer_id) query = query.eq("status", "published");
    } else {
      query = query.eq("status", "published");
    }

    if (category) query = query.eq("category", category);
    if (difficulty) query = query.eq("difficulty", difficulty);
    if (search) query = query.ilike("title", `%${escapeLike(search)}%`);
    if (page.paginate && page.cursor) query = query.lt("created_at", page.cursor);

    const { data, error } = await query;
    const headers = listResponseHeaders({ cacheable, startedAt: t0, dbMs: performance.now() - dbStart });
    if (error) { console.error("Lessons GET error:", error); throw error; }
    // Ro'yxatda pullik kontent (content) qaytarilmaydi — u faqat /api/lessons/[id] orqali
    const stripped = (data || []).map(({ content, ...rest }: any) => rest);
    if (page.paginate) {
      const { items, next_cursor } = buildPage(stripped, page.limit, (r: any) => r.created_at);
      return NextResponse.json({ items, next_cursor }, { headers });
    }
    return NextResponse.json(stripped, { headers });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST /api/lessons — darslik yaratish
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    // Darslik yaratish faqat trener (yoki admin) uchun: oddiy foydalanuvchi sotgan pul hisobsiz qolardi
    const { data: prof } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (prof?.role !== "trainer" && prof?.role !== "admin") {
      return NextResponse.json({ message: "Darslik yaratish faqat trenerlar uchun" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, price, pricing_model, price_lifetime, price_monthly, category, difficulty, cover_url, sections, status } = body;

    if (!title?.trim()) return NextResponse.json({ message: "Nom kerak" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("lessons")
      .insert({
        trainer_id: user.id,
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
      .select(`*, profiles:trainer_id (id, full_name, avatar_url)`)
      .single();

    if (error) { console.error("Lesson create error:", error); throw error; }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
