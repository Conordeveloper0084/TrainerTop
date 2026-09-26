import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

const PAGE = 30;

// GET /api/admin/platform-reviews?filter=all|featured|hidden|with_comment&page=0 — baholar (email bilan) va umumiy statistika
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    const sp = new URL(request.url).searchParams;
    const filter = ["all", "featured", "hidden", "with_comment"].includes(sp.get("filter") || "") ? (sp.get("filter") as string) : "all";
    const page = Math.max(0, parseInt(sp.get("page") || "0", 10) || 0);
    const [list, stats] = await Promise.all([
      supabaseAdmin.rpc("admin_platform_reviews", { p_filter: filter, p_limit: PAGE, p_offset: page * PAGE }),
      supabaseAdmin.rpc("platform_review_stats"),
    ]);
    if (list.error) throw list.error;
    return NextResponse.json({ total: list.data?.total || 0, rows: list.data?.rows || [], page_size: PAGE, stats: stats.data || null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Admin platform reviews GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
