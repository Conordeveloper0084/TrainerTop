import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getBannedUserIds } from "@/lib/bans";
import { sanitizeSearch } from "@/lib/search";

const PAGE = 30;

// GET /api/followers?page=0&q= — MENING obunachilarim (trener ham, atlet ham). Faqat o'zining ro'yxati.
// Trenerlar uchun: obunachi shogirdmi (darsligini sotib olganmi) ham ko'rsatiladi. Email/telefon CHIQMAYDI.
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    const sp = new URL(request.url).searchParams;
    const page = Math.max(0, parseInt(sp.get("page") || "0", 10) || 0);
    const search = sanitizeSearch(sp.get("q"));

    const banned = await getBannedUserIds();
    let q = supabaseAdmin.from("follows")
      .select("created_at, follower:follower_id!inner (id, full_name, avatar_url, role, athlete_badge)", { count: "exact" })
      .eq("trainer_id", user.id).order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (search) q = q.ilike("follower.full_name", `%${search}%`);
    const { data, count, error } = await q;
    if (error) throw error;

    const rows = ((data || []) as any[]).filter((r) => r.follower && !banned.includes(r.follower.id));
    const ids = rows.map((r) => r.follower.id);
    const trainerIds = rows.filter((r) => r.follower.role === "trainer").map((r) => r.follower.id);
    const [buyers, verified] = await Promise.all([
      ids.length ? supabaseAdmin.from("purchases").select("user_id").eq("trainer_id", user.id).eq("status", "paid").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
      trainerIds.length ? supabaseAdmin.from("trainer_profiles").select("user_id").in("user_id", trainerIds).eq("is_verified", true) : Promise.resolve({ data: [] as any[] }),
    ]);
    const students = new Set((buyers.data || []).map((b: any) => b.user_id));
    const verifiedTrainers = new Set((verified.data || []).map((v: any) => v.user_id));

    return NextResponse.json({
      total: count || 0, page_size: PAGE,
      rows: rows.map((r) => ({
        id: r.follower.id, full_name: r.follower.full_name, avatar_url: r.follower.avatar_url, role: r.follower.role, followed_at: r.created_at,
        is_student: students.has(r.follower.id),
        badge: r.follower.role === "trainer" ? (verifiedTrainers.has(r.follower.id) ? "trainer" : null) : r.follower.athlete_badge ? "athlete" : null,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Followers GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
