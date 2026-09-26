import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { buildMemberList } from "@/lib/chat";
import { UUID_RE } from "@/lib/db-errors";

// GET /api/admin/groups/[id]/members — barcha a'zolar (holat, chora sababi, obuna) va chora tarixi
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });
    const { data: g } = await supabaseAdmin.from("chat_groups").select("lesson_id").eq("id", params.id).maybeSingle();
    if (!g) return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });
    const members = await buildMemberList(params.id, g.lesson_id);
    const { data: actions } = await supabaseAdmin.from("chat_group_actions")
      .select("id, user_id, action, reason, note, until, actor_id, actor_is_admin, created_at").eq("group_id", params.id).order("created_at", { ascending: false }).limit(50);
    return NextResponse.json({ members, actions: actions || [] });
  } catch (error: any) {
    console.error("Admin group members:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
