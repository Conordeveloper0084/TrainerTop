import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicTrainer } from "@/lib/public-fields";
import { getBannedUserIds, notInList } from "@/lib/bans";
import { parsePageParams, buildPage } from "@/lib/pagination";

// GET /api/trainers — trenerlar ro'yxati. ?limit=&cursor= berilsa {items, next_cursor} (ilova
// uchun), berilmasa eski xatti-harakat (butun ro'yxat) saqlanadi. Qidiruv (search) natija ustida
// xotirada filtrlanadi, shuning uchun sahifalash HAM shu (filtrlangan) massiv ustida bajariladi —
// bazadan "limit+1" qilib olish bu yerda ishlamaydi, chunki qidiruv nechta mos kelishini oldindan
// bilib bo'lmaydi.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const spec = searchParams.get("specialization") || "";
    const city = searchParams.get("city") || "";
    const workType = searchParams.get("work_type") || "";
    const page = parsePageParams(searchParams);

    // Trainer profillar olish
    let query = supabaseAdmin
      .from("trainer_profiles")
      .select(`*, profiles:user_id (id, full_name, avatar_url, username)`)
      .eq("is_published", true)
      .order("rating", { ascending: false });

    const banned = await getBannedUserIds();
    if (banned.length > 0) query = query.not("user_id", "in", notInList(banned));

    if (city) query = query.eq("city", city);
    if (workType) query = query.eq("work_type", workType);
    if (spec) query = query.contains("specializations", [spec]);

    const { data, error } = await query;
    if (error) throw error;

    let trainers = data || [];

    // Search filter (ism yoki @username bo'yicha)
    if (search) {
      const s = search.toLowerCase().replace(/^@/, "");
      trainers = trainers.filter((t: any) =>
        t.profiles?.full_name?.toLowerCase().includes(s) ||
        t.profiles?.username?.toLowerCase().includes(s) ||
        t.bio?.toLowerCase().includes(s)
      );
    }

    // Faqat ommaviy maydonlar (karta, balans, email chiqmaydi)
    const result = trainers.map((t: any) => publicTrainer(t, ["id", "full_name", "avatar_url", "username"]));

    if (page.paginate) {
      // rating bo'yicha tartiblangan, lekin rating'da teng qiymatlar (masalan 0.0) ko'p bo'lishi
      // mumkin — shuning uchun cursor sifatida trenerning NOYOB id'si ishlatiladi (rating emas),
      // aks holda bir xil reytingli trenerlar sahifalar orasida takrorlanib/tushib qolardi.
      const startIdx = page.cursor ? result.findIndex((t: any) => t.id === page.cursor) + 1 : 0;
      const slice = result.slice(Math.max(startIdx, 0), Math.max(startIdx, 0) + page.limit + 1);
      const { items, next_cursor } = buildPage(slice, page.limit, (r: any) => r.id);
      return NextResponse.json({ items, next_cursor });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
