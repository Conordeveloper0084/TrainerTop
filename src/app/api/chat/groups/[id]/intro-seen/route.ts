import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getGroupAccess } from "@/lib/chat";

// POST /api/chat/groups/[id]/intro-seen — "Guruh haqida" tanishtiruvi ko'rildi (keyingi safar o'zi chiqmaydi)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    const access = await getGroupAccess(params.id, user.id);
    if (access !== "owner" && access !== "active") return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });
    await supabaseAdmin.from("chat_group_members").update({ seen_intro_at: new Date().toISOString() })
      .eq("group_id", params.id).eq("user_id", user.id).is("seen_intro_at", null);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Group intro-seen:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
