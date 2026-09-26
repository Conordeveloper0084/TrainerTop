import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { queryMessages, isInitialLoad } from "@/lib/chat";
import { UUID_RE } from "@/lib/db-errors";

// GET /api/admin/groups/[id]/messages?before=<ISO> — admin guruhdagi BARCHA xabarlarni o'qiydi (moderatsiya).
// Har safar guruh xabarlari ochilganda (birinchi sahifa) audit jurnaliga yoziladi.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });
    const { data: g } = await supabaseAdmin.from("chat_groups").select("id, name").eq("id", params.id).maybeSingle();
    if (!g) return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });

    const sp = new URL(request.url).searchParams;
    const data = await queryMessages("group_id", params.id, sp);
    if (isInitialLoad(sp)) await logAdmin(admin.id, "group_read", "chat_group", params.id, { name: g.name });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Admin group messages:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
