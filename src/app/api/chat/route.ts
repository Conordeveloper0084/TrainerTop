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

// GET /api/chat — conversationlar
export async function GET() {
  try {
    const { data: { user } } = await getUser();
    if (!user) return NextResponse.json([], { status: 200 });

    const { data, error } = await supabaseAdmin
      .from("conversations")
      .select(`*, trainer:trainer_id (id, full_name, avatar_url), user:user_id (id, full_name, avatar_url)`)
      .or(`trainer_id.eq.${user.id},user_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) throw error;

    const conversations = (data || []).map((c: any) => ({
      ...c,
      other: c.trainer_id === user.id ? c.user : c.trainer,
      my_unread: c.trainer_id === user.id ? c.trainer_unread : c.user_unread,
    }));

    return NextResponse.json(conversations);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST /api/chat — yangi conversation yaratish yoki mavjudni topish
export async function POST(request: NextRequest) {
  try {
    const { data: { user } } = await getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { trainer_id } = await request.json();

    // Mavjud conversation tekshirish
    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .or(`and(trainer_id.eq.${trainer_id},user_id.eq.${user.id}),and(trainer_id.eq.${user.id},user_id.eq.${trainer_id})`)
      .maybeSingle();

    if (existing) return NextResponse.json({ id: existing.id });

    // Yangi yaratish
    const { data, error } = await supabaseAdmin
      .from("conversations")
      .insert({ trainer_id, user_id: user.id })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
