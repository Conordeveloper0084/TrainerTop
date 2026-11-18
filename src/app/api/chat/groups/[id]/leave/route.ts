import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getGroupAccess } from "@/lib/chat";

// POST /api/chat/groups/[id]/leave
//  • obunasi tugagan (qulflangan) guruh: chiqib ketish → ro'yxatdan yo'qoladi; oylik to'lov yangilansa guruh o'zi qaytadi.
//  • chiqarilgan (removed) guruh: ro'yxatdan olib tashlash — holat 'removed' QOLADI (qayta to'lab kirib bo'lmasin),
//    faqat ro'yxatda ko'rinmaydi. Qaytarilsa yana ko'rinadi.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    const access = await getGroupAccess(params.id, user.id);
    if (access === "expired") {
      const { error } = await supabaseAdmin.from("chat_group_members").update({ status: "left" })
        .eq("group_id", params.id).eq("user_id", user.id).eq("status", "active");
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    if (access === "removed") {
      const { error } = await supabaseAdmin.from("chat_group_members").update({ dismissed_at: new Date().toISOString() })
        .eq("group_id", params.id).eq("user_id", user.id).eq("status", "removed");
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ message: "Faqat obunasi tugagan yoki chiqarilgan guruhni ro'yxatdan olib tashlash mumkin" }, { status: 400 });
  } catch (error: any) {
    console.error("Group leave:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
