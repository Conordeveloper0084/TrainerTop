import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

const PAGE = 30;

// GET /api/admin/reports?status=open|dismissed|actioned|all&group=<id>&page=0 — xabarlarga shikoyatlar
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    const sp = new URL(request.url).searchParams;
    const status = sp.get("status") || "open";
    const group = sp.get("group");
    const page = Math.max(0, parseInt(sp.get("page") || "0", 10) || 0);

    let q = supabaseAdmin.from("chat_reports")
      .select("id, message_id, group_id, conversation_id, reason, note, snapshot, status, handled_at, handled_note, created_at, reporter:reporter_id (id, full_name), reported:reported_user_id (id, full_name), group:group_id (id, name)")
      .order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (["open", "dismissed", "actioned"].includes(status)) q = q.eq("status", status);
    if (group) q = q.eq("group_id", group);
    const { data, error } = await q;
    if (error) throw error;
    const count = async (s: string) => (await supabaseAdmin.from("chat_reports").select("id", { count: "exact", head: true }).eq("status", s)).count || 0;
    const [open, dismissed, actioned] = await Promise.all([count("open"), count("dismissed"), count("actioned")]);
    return NextResponse.json({ reports: data || [], counts: { open, dismissed, actioned }, has_more: (data || []).length === PAGE }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Admin reports GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
