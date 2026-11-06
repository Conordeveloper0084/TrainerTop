import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PUBLIC_LIST_CACHE_CONTROL } from "@/lib/http-cache";

// Bazadagi `get_setting(...)` standart qiymatlari bilan bir xil (migration-v12, request_payout)
export const DEFAULT_MIN_PAYOUT = 100000;
export const DEFAULT_COMMISSION_RATE = 10;

// GET /api/settings/public — LOGINSIZ, hamma uchun bir xil (ilovalar va sayt)
// { min_payout: <so'm, butun son>, default_commission_rate: <foiz> }
//   min_payout — pul yechish minimumi (admin paneldagi "Minimal yechish summasi"); SERVER baribir
//     POST /api/payouts da shu sozlamadan tekshiradi — bu faqat ekranda ko'rsatish uchun.
//   default_commission_rate — UMUMIY komissiya (%). Trenerning SHAXSIY komissiyasi bu yerda YO'Q (u faqat
//     o'ziga ko'rinadi: GET /api/trainer/earnings → rate / custom_rate, GET /api/trainer-profile → commission_rate).
// CDN keshlanadi (token yuborilmasa): sozlama o'zgarsa ~30 s (eng ko'pi ~5.5 daqiqa) kechikib ko'rinadi.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.from("platform_settings").select("key, value").in("key", ["min_payout_amount", "default_commission_percent"]);
    if (error) throw error;
    const map: Record<string, number> = {};
    for (const r of data || []) map[(r as any).key] = Number((r as any).value);
    const minPayout = Number.isFinite(map.min_payout_amount) && map.min_payout_amount > 0 ? Math.round(map.min_payout_amount) : DEFAULT_MIN_PAYOUT;
    const rate = Number.isFinite(map.default_commission_percent) && map.default_commission_percent >= 0 && map.default_commission_percent <= 100
      ? map.default_commission_percent : DEFAULT_COMMISSION_RATE;
    return NextResponse.json({ min_payout: minPayout, default_commission_rate: rate }, { headers: { "Cache-Control": PUBLIC_LIST_CACHE_CONTROL } });
  } catch (error: any) {
    console.error("Public settings:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
