import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

const PAGE = 30;

// GET /api/admin/groups?q=&sort=activity|members|messages|reports&page=0 — barcha guruhlar va statistika
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    const sp = new URL(request.url).searchParams;
    const q = (sp.get("q") || "").trim().slice(0, 60);
    const sort = ["activity", "members", "messages", "reports"].includes(sp.get("sort") || "") ? (sp.get("sort") as string) : "activity";
    const page = Math.max(0, parseInt(sp.get("page") || "0", 10) || 0);
    const { data, error } = await supabaseAdmin.rpc("admin_group_stats", { p_search: q, p_sort: sort, p_limit: PAGE, p_offset: page * PAGE });
    if (error) throw error;
    return NextResponse.json({ total: data?.total || 0, rows: data?.rows || [], page_size: PAGE }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Admin groups list:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
