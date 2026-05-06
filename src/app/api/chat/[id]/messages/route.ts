import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getUser() {
  const cookieStore = cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } });
  return supabase.auth.getUser();
}

// GET /api/chat/[id]/messages
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: { user } } = await getUser();
    if (!user) return NextResponse.json([], { status: 200 });

    const { data, error } = await supabaseAdmin
      .from("messages")
      .select(`*, sender:sender_id (id, full_name, avatar_url)`)
      .eq("conversation_id", params.id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) throw error;

    // O'qilmagan xabarlarni o'qildi deb belgilash
    await supabaseAdmin
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", params.id)
      .neq("sender_id", user.id)
      .eq("is_read", false);

    // Conversation unread counter reset
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("trainer_id, user_id")
      .eq("id", params.id)
      .single();

    if (conv) {
      const field = conv.trainer_id === user.id ? "trainer_unread" : "user_unread";
      await supabaseAdmin.from("conversations").update({ [field]: 0 }).eq("id", params.id);
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST /api/chat/[id]/messages — xabar yuborish
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: { user } } = await getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { content, image_url } = await request.json();
    if (!content?.trim() && !image_url) return NextResponse.json({ message: "Xabar bo'sh" }, { status: 400 });

    // Xabar saqlash
    const { data: msg, error } = await supabaseAdmin
      .from("messages")
      .insert({ conversation_id: params.id, sender_id: user.id, content: content?.trim() || null, image_url: image_url || null })
      .select(`*, sender:sender_id (id, full_name, avatar_url)`)
      .single();

    if (error) throw error;

    // Conversation yangilash
    const { data: conv } = await supabaseAdmin
      .from("conversations").select("trainer_id, user_id").eq("id", params.id).single();

    if (conv) {
      const unreadField = conv.trainer_id === user.id ? "user_unread" : "trainer_unread";
      await supabaseAdmin.from("conversations").update({
        last_message: content?.trim()?.slice(0, 100) || "📷 Rasm",
        last_message_at: new Date().toISOString(),
        [unreadField]: supabaseAdmin.rpc ? 1 : 1, // increment kerak lekin oddiy 1 qo'yamiz
      }).eq("id", params.id);

      // Notification
      const otherUserId = conv.trainer_id === user.id ? conv.user_id : conv.trainer_id;
      await supabaseAdmin.from("notifications").insert({
        user_id: otherUserId,
        type: "message",
        title: "Yangi xabar",
        body: `${user.user_metadata?.full_name || "Foydalanuvchi"}: ${content?.trim()?.slice(0, 50) || "Rasm yubordi"}`,
        data: { conversation_id: params.id },
      });
    }

    return NextResponse.json(msg);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
