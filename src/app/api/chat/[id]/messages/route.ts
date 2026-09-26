import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getConversationForUser, validateOutgoing, messagePreview, queryMessages, isInitialLoad } from "@/lib/chat";

// GET /api/chat/[id]/messages?before=<ISO>&limit=50 (cookie yoki Bearer token)
// Faqat suhbat ISHTIROKCHISI o'qiy oladi. Oxirgi N ta xabar (eskisi tepada); `before` bilan eskilarini yuklash.
// Birinchi yuklashda (before yo'q) xabarlar "o'qildi" deb belgilanadi.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json([], { status: 200 });

    const conv = await getConversationForUser(params.id, user.id);
    if (!conv) return NextResponse.json({ message: "Suhbat topilmadi" }, { status: 404 });

    const sp = new URL(request.url).searchParams;
    // Xabarlarni o'qish va "o'qildi" belgilarini qo'yish BIR-BIRIGA bog'liq emas — parallel bajarilsa
    // (ketma-ket emas) chat ochilishi sezilarli tezlashadi (foydalanuvchi o'z belgisini kutib turmaydi).
    const [data] = await Promise.all([
      queryMessages("conversation_id", params.id, sp),
      isInitialLoad(sp)
        ? Promise.all([
            supabaseAdmin.from("messages").update({ is_read: true }).eq("conversation_id", params.id).neq("sender_id", user.id).eq("is_read", false),
            supabaseAdmin.from("conversations").update({ [conv.trainer_id === user.id ? "trainer_unread" : "user_unread"]: 0 }).eq("id", params.id),
          ])
        : Promise.resolve(null),
    ]);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Chat messages GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// POST /api/chat/[id]/messages — xabar yuborish (matn, rasm, ovoz, video)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const conv = await getConversationForUser(params.id, user.id);
    if (!conv) return NextResponse.json({ message: "Suhbat topilmadi" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const v = validateOutgoing(body, user.id);
    if (v.ok === false) return NextResponse.json({ message: v.message }, { status: v.status });

    const { data: msg, error } = await supabaseAdmin
      .from("messages")
      .insert({ conversation_id: params.id, sender_id: user.id, ...v.row })
      .select(`*, sender:sender_id (id, full_name, avatar_url)`)
      .single();
    if (error) throw error;

    const preview = messagePreview(v.row.type, v.row.content);
    const iAmTrainer = conv.trainer_id === user.id;
    const unreadField = iAmTrainer ? "user_unread" : "trainer_unread";
    const currentUnread = (iAmTrainer ? conv.user_unread : conv.trainer_unread) || 0;
    await supabaseAdmin.from("conversations").update({
      last_message: preview, last_message_at: new Date().toISOString(), [unreadField]: currentUnread + 1,
    }).eq("id", params.id);

    await supabaseAdmin.from("notifications").insert({
      user_id: iAmTrainer ? conv.user_id : conv.trainer_id,
      type: "message",
      title: "Yangi xabar",
      body: `${user.user_metadata?.full_name || "Foydalanuvchi"}: ${preview.slice(0, 50)}`,
      data: { conversation_id: params.id },
    });

    return NextResponse.json(msg);
  } catch (error: any) {
    console.error("Chat messages POST:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
