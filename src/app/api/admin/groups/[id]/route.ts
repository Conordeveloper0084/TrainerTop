import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { UUID_RE } from "@/lib/db-errors";

// PATCH /api/admin/groups/[id] — guruhni yopish (arxivlash) yoki qayta ochish. Body: { archived: boolean }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });

    const { archived } = await request.json().catch(() => ({}));
    if (typeof archived !== "boolean") return NextResponse.json({ message: "archived (true/false) kerak" }, { status: 400 });

    const { data, error } = await supabaseAdmin.from("chat_groups").update({ is_archived: archived, updated_at: new Date().toISOString() })
      .eq("id", params.id).select("id, name, is_archived").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });

    await logAdmin(admin.id, archived ? "group_archive" : "group_restore", "chat_group", params.id, { name: data.name });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Admin group PATCH:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// GET /api/admin/groups/[id] — guruh, statistika (javob tezligi, kunlik grafik, faol yozuvchilar) va oxirgi AI tahlil
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });
    const { data: group } = await supabaseAdmin.from("chat_groups")
      .select("id, name, bio, avatar_url, is_archived, created_at, last_message_at, lesson:lesson_id (id, title, status, price_lifetime, price_monthly), owner:owner_id (id, full_name, avatar_url)")
      .eq("id", params.id).maybeSingle();
    if (!group) return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });
    const [{ data: stats }, { data: analysis }] = await Promise.all([
      supabaseAdmin.rpc("admin_group_detail", { p_group: params.id }),
      supabaseAdmin.from("chat_group_analyses").select("result, message_count, created_at").eq("group_id", params.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return NextResponse.json({ group, stats: stats || null, analysis: analysis || null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Admin group GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
