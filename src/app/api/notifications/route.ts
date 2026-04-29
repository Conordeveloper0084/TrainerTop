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

// GET /api/notifications
export async function GET() {
  try {
    const { data: { user } } = await getUser();
    if (!user) return NextResponse.json([]);

    const { data } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// PUT /api/notifications — barchasini o'qildi deb belgilash
export async function PUT() {
  try {
    const { data: { user } } = await getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
