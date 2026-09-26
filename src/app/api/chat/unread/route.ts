import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

// GET /api/chat/unread — o'qilmagan xabarlar SONI: 1:1 suhbatlar + darslik guruhlari + rasmiy kanal e'lonlari (yengil).
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ count: 0 });

    // Rasmiy TrainerTop kanalidagi o'qilmagan e'lonlar ham chat belgisiga qo'shiladi. Kanal bazasi tayyor bo'lmasa — chat soni buzilmaydi.
    const [chat, official] = await Promise.all([
      supabaseAdmin.rpc("chat_unread_total", { p_user: user.id }),
      Promise.resolve(supabaseAdmin.rpc("announcement_summary", { p_user: user.id })).catch(() => ({ data: null, error: true })),
    ]);
    if (chat.error) throw chat.error;
    const extra = official && !(official as any).error ? Number((official as any).data?.unread) || 0 : 0;
    return NextResponse.json({ count: (Number(chat.data) || 0) + extra }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Chat unread:", error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
