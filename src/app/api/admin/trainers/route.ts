import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { getBannedUserIds } from "@/lib/bans";
import { sanitizeSearch } from "@/lib/search";

// GET /api/admin/trainers — trenerlar (moliya, komissiya, nishon, ban holati bilan)
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const search = sanitizeSearch(new URL(request.url).searchParams.get("search"));

    let query = supabaseAdmin
      .from("profiles")
      .select(`*, trainer_profile:trainer_profiles!trainer_profiles_user_id_fkey(*)`)
      .eq("role", "trainer")
      .order("created_at", { ascending: false });
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data: trainers, error } = await query.limit(200);
    if (error) throw error;

    const ids = (trainers || []).map((t: any) => t.id);
    const [lessonsRes, payoutsRes, defRes, banned] = await Promise.all([
      ids.length ? supabaseAdmin.from("lessons").select("trainer_id, status").in("trainer_id", ids) : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabaseAdmin.from("payouts").select("trainer_id, amount").eq("status", "pending").in("trainer_id", ids) : Promise.resolve({ data: [] as any[] }),
      supabaseAdmin.from("platform_settings").select("value").eq("key", "default_commission_percent").maybeSingle(),
      getBannedUserIds(),
    ]);

    const defaultRate = Number((defRes as any).data?.value ?? 10);
    const lessonCount = new Map<string, number>();
    for (const l of (lessonsRes.data || []) as any[]) {
      if (l.status === "removed") continue;
      lessonCount.set(l.trainer_id, (lessonCount.get(l.trainer_id) || 0) + 1);
    }
    const pending = new Map<string, number>();
    for (const p of (payoutsRes.data || []) as any[]) pending.set(p.trainer_id, (pending.get(p.trainer_id) || 0) + p.amount);
    const bannedSet = new Set(banned);

    const result = (trainers || []).map((t: any) => {
      const tp = Array.isArray(t.trainer_profile) ? t.trainer_profile[0] : t.trainer_profile;
      if (tp) { delete tp.card_number; delete tp.card_holder; }
      return {
        ...t,
        trainer_profile: tp,
        lessons_count: lessonCount.get(t.id) || 0,
        pending_payout: pending.get(t.id) || 0,
        effective_commission: tp?.commission_rate ?? defaultRate,
        default_commission: defaultRate,
        is_banned: bannedSet.has(t.id),
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Admin trainers:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
