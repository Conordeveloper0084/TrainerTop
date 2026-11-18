import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getConversationForUser } from "@/lib/chat";

// DELETE /api/chat/[id] — 1:1 suhbatni FAQAT O'ZIM uchun o'chirish (cookie yoki Bearer token).
// Suhbat mening ro'yxatimdan yo'qoladi va eski xabarlar ko'rinmaydi; suhbatdosh uchun hech narsa o'zgarmaydi.
// Yangi xabar kelsa (yoki men yozsam) suhbat ro'yxatga qaytadi — faqat yangi xabarlar bilan.
// Qayta chaqirish xavfsiz (idempotent): o'chirish vaqti yangilanadi. Javob: { success: true }.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const conv = await getConversationForUser(params.id, user.id);
    if (!conv) return NextResponse.json({ message: "Suhbat topilmadi" }, { status: 404 });

    const { error } = await supabaseAdmin
      .from("conversation_clears")
      .upsert({ conversation_id: conv.id, user_id: user.id, cleared_at: new Date().toISOString() }, { onConflict: "conversation_id,user_id" });
    if (error) throw error;

    // O'chirilgan suhbatning o'qilmagan sanog'i (mening tomonimdagi) nolga tushadi
    await supabaseAdmin.from("conversations")
      .update({ [conv.trainer_id === user.id ? "trainer_unread" : "user_unread"]: 0 })
      .eq("id", conv.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Chat DELETE:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
