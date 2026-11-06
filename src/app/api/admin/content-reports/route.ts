import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

const PAGE = 50;

// GET /api/admin/content-reports?reviewed=false — post/komment/darslik/foydalanuvchiga umumiy shikoyatlar
// (standart: hali ko'rilmaganlar, eng yangisi birinchi). Chat xabar shikoyatlari BUNGA kirmaydi —
// ular alohida, mavjud /api/admin/reports (chat_reports) orqali.
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const sp = new URL(request.url).searchParams;
    let q = supabaseAdmin.from("reports")
      .select("*, reporter:reporter_id (full_name, avatar_url, username)")
      .order("created_at", { ascending: false }).limit(PAGE);
    if (sp.get("reviewed") === "true") q = q.not("reviewed_at", "is", null);
    else if (sp.get("reviewed") !== "all") q = q.is("reviewed_at", null);   // standart: faqat hali ko'rilmaganlar
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json(data || [], { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Admin content-reports GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
