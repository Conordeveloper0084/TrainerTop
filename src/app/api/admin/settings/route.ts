import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { strictNumber } from "@/lib/num";

// Har bir sozlama: chegaralar (min/max) va butun son bo'lishi shartmi
const RULES: Record<string, { min: number; max: number; integer: boolean; label: string }> = {
  default_commission_percent: { min: 0, max: 100, integer: false, label: "Umumiy komissiya (%)" },
  min_payout_amount: { min: 1000, max: 100_000_000, integer: true, label: "Minimal yechish summasi" },
  badge_min_followers: { min: 1, max: 10_000_000, integer: true, label: "Nishon uchun obunachi soni" },
  badge_min_rating: { min: 1, max: 5, integer: false, label: "Nishon uchun minimal reyting" },
  badge_min_reviews: { min: 1, max: 100_000, integer: true, label: "Nishon uchun minimal sharhlar soni" },
  athlete_badge_min_followers: { min: 1, max: 10_000_000, integer: true, label: "Atlet nishoni uchun obunachi soni" },
};

// GET /api/admin/settings
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    const { data, error } = await supabaseAdmin.from("platform_settings").select("key, value, updated_at");
    if (error) throw error;
    const values: Record<string, number> = {};
    for (const r of data || []) values[r.key] = Number(r.value);
    return NextResponse.json({ values, rules: RULES });
  } catch (error: any) {
    console.error("Admin settings GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// PUT /api/admin/settings — Body: { key: value, ... } (faqat ruxsat etilgan kalitlar)
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const updates: { key: string; value: number }[] = [];
    for (const [key, raw] of Object.entries(body)) {
      const rule = RULES[key];
      if (!rule) return NextResponse.json({ message: `Noma'lum sozlama: ${key}` }, { status: 400 });
      const value = strictNumber(raw);
      if (value === null || value < rule.min || value > rule.max || (rule.integer && !Number.isInteger(value))) {
        return NextResponse.json({ message: `${rule.label}: ${rule.min} dan ${rule.max} gacha${rule.integer ? " (butun son)" : ""} bo'lishi kerak` }, { status: 400 });
      }
      updates.push({ key, value: Math.round(value * 100) / 100 });
    }
    if (updates.length === 0) return NextResponse.json({ message: "O'zgartirish yo'q" }, { status: 400 });

    const { data: old } = await supabaseAdmin.from("platform_settings").select("key, value").in("key", updates.map((u) => u.key));
    const oldMap = Object.fromEntries((old || []).map((r: any) => [r.key, Number(r.value)]));

    for (const u of updates) {
      const { error } = await supabaseAdmin.from("platform_settings")
        .upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString(), updated_by: admin.id }, { onConflict: "key" });
      if (error) throw error;
      await logAdmin(admin.id, "setting_change", "setting", u.key, { from: oldMap[u.key] ?? null, to: u.value });
    }
    // Nishon chegarasi o'zgargan bo'lsa — yangi chegaraga mos trenerlarga nishon beriladi
    let badgesChecked: number | null = null;
    if (updates.some((u) => u.key.startsWith("badge_"))) {
      const { data: n } = await supabaseAdmin.rpc("refresh_all_badges");
      badgesChecked = typeof n === "number" ? n : null;
    }
    // Atlet nishoni chegarasi o'zgargan bo'lsa — chegaraga yetgan atletlarga nishon beriladi
    let athleteChecked: number | null = null;
    if (updates.some((u) => u.key === "athlete_badge_min_followers")) {
      const { data: n } = await supabaseAdmin.rpc("refresh_all_athlete_badges");
      athleteChecked = typeof n === "number" ? n : null;
    }
    return NextResponse.json({ success: true, badges_checked: badgesChecked, athlete_badges_checked: athleteChecked });
  } catch (error: any) {
    console.error("Admin settings PUT:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
