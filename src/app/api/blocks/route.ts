import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { UUID_RE } from "@/lib/db-errors";

// GET /api/blocks — o'zi bloklagan foydalanuvchilar ro'yxati
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    const { data } = await supabaseAdmin.from("blocks").select("blocked_id, created_at, profiles:blocked_id (full_name, avatar_url)").eq("blocker_id", user.id).order("created_at", { ascending: false });
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Blocks GET:", error);
    return NextResponse.json([]);
  }
}

// POST /api/blocks — { user_id } — bloklash (bir tomonlama: shu odamning kontenti FAQAT sizning lentangizda ko'rinmay qoladi)
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (typeof body.user_id !== "string" || !UUID_RE.test(body.user_id)) return NextResponse.json({ message: "Foydalanuvchi topilmadi" }, { status: 404 });
    if (body.user_id === user.id) return NextResponse.json({ message: "O'zingizni bloklay olmaysiz" }, { status: 400 });

    const { data: target } = await supabaseAdmin.from("profiles").select("id").eq("id", body.user_id).maybeSingle();
    if (!target) return NextResponse.json({ message: "Foydalanuvchi topilmadi" }, { status: 404 });

    const { error } = await supabaseAdmin.from("blocks").insert({ blocker_id: user.id, blocked_id: body.user_id });
    if (error) {
      if ((error as any).code === "23505") return NextResponse.json({ success: true });   // allaqachon bloklangan — muvaffaqiyat sifatida qaytariladi (idempotent)
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Blocks POST:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
