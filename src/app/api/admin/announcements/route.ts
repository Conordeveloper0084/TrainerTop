import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { sendAnnouncement } from "@/lib/announcements-server";

const PAGE = 30;

// GET /api/admin/announcements?page=0 — yuborilgan e'lonlar tarixi (nechta odam kanalni ochib ko'rgani bilan) va hozirgi auditoriya
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    const page = Math.max(0, parseInt(new URL(request.url).searchParams.get("page") || "0", 10) || 0);
    const [{ data, error }, { count }] = await Promise.all([
      supabaseAdmin.rpc("admin_announcement_list", { p_limit: PAGE, p_offset: page * PAGE }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    if (error) throw error;
    return NextResponse.json({ total: data?.total || 0, rows: data?.rows || [], page_size: PAGE, audience: count || 0 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Admin announcements GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// POST /api/admin/announcements — { kind: "all"|"user", target_user_id?, title, body, image_url?, link_url?, link_label?, client_token? }
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const r = await sendAnnouncement(admin.id, body);
    if (r.ok === false) return NextResponse.json({ message: r.message }, { status: r.status });
    if (!r.duplicate) await logAdmin(admin.id, "announcement_send", "announcement", r.id, { kind: body.kind, target_user_id: body.target_user_id ?? null, recipients: r.recipients });
    return NextResponse.json({ success: true, id: r.id, recipients: r.recipients, duplicate: r.duplicate });
  } catch (error: any) {
    console.error("Admin announcements POST:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
