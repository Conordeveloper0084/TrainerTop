import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getGroupAccess, buildMemberList } from "@/lib/chat";

// GET /api/chat/groups/[id]/members — a'zolar ro'yxati.
// Guruh admini hammani (cheklangan, obunasi tugagan, chiqarilganlar sabab bilan) ko'radi;
// oddiy a'zo faqat faol a'zolarni — chora sabablari BOSHQALARGA ko'rsatilmaydi.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    const access = await getGroupAccess(params.id, user.id);
    if (access !== "owner" && access !== "active") return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });

    const { data: g } = await supabaseAdmin.from("chat_groups").select("lesson_id").eq("id", params.id).maybeSingle();
    if (!g) return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });

    const all = await buildMemberList(params.id, g.lesson_id);
    if (access === "owner") return NextResponse.json(all);
    const visible = all
      .filter((m: any) => m.state === "owner" || m.state === "active" || m.state === "muted")
      .map((m: any) => ({ user_id: m.user_id, role: m.role, status: m.status, state: m.state === "muted" ? "active" : m.state, joined_at: m.joined_at, full_name: m.full_name, avatar_url: m.avatar_url }));
    return NextResponse.json(visible);
  } catch (error: any) {
    console.error("Group members GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
