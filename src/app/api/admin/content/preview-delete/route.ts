import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/admin/content/preview-delete — { type: "post"|"lesson", id } — FAQAT KO'RISH.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const type = body.type;
    const id = body.id;
    if (type !== "post" && type !== "lesson") return NextResponse.json({ message: "type 'post' yoki 'lesson' bo'lishi kerak" }, { status: 400 });
    if (typeof id !== "string" || !UUID_RE.test(id)) return NextResponse.json({ message: "id noto'g'ri" }, { status: 400 });

    const { data, error } = await supabaseAdmin.rpc("admin_preview_content_deletion", { p_type: type, p_id: id });
    if (error) throw error;
    return NextResponse.json({ report: data });
  } catch (error: any) {
    console.error("Admin content preview-delete:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
