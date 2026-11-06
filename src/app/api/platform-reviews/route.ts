import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const EMPTY = { count: 0, average: null, distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }, featured: [] };

// GET /api/platform-reviews — OCHIQ: umumiy baho va admin tanlagan sharhlar (bosh sahifa uchun). 5 daqiqa keshlanadi.
// Ism qisqartirilgan ("Ali K."), email/id chiqmaydi. Baza hali yangilanmagan bo'lsa — bo'sh natija (sayt buzilmaydi).
export async function GET() {
  try {
    const [stats, featured] = await Promise.all([supabaseAdmin.rpc("platform_review_stats"), supabaseAdmin.rpc("platform_review_featured", { p_limit: 6 })]);
    if (stats.error || featured.error) { console.error("Platform reviews:", stats.error || featured.error); return NextResponse.json(EMPTY); }
    return NextResponse.json(
      { count: Number(stats.data?.count) || 0, average: stats.data?.average != null ? Number(stats.data.average) : null, distribution: stats.data?.distribution || EMPTY.distribution, featured: featured.data || [] },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (error: any) {
    console.error("Platform reviews:", error);
    return NextResponse.json(EMPTY);
  }
}
