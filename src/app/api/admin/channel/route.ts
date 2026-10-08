import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { CHANNEL_NAME_MAX, CHANNEL_BIO_MAX } from "@/lib/announcements";

const ERRORS: Record<string, [number, string]> = {
  FORBIDDEN: [403, "Ruxsat yo'q"],
  BAD_NAME: [400, `Kanal nomi 1-${CHANNEL_NAME_MAX} belgi bo'lsin`],
  BAD_BIO: [400, `Bio ${CHANNEL_BIO_MAX} belgidan oshmasin`],
  BAD_AVATAR: [400, "Rasm manzili noto'g'ri"],
  BAD_USERNAME: [400, "Username 3-30 belgi, faqat lotin harf/raqam/pastki chiziq (_) bo'lishi kerak"],
  USERNAME_TAKEN: [409, "Bu username bir foydalanuvchida band"],
};

// GET /api/admin/channel — joriy kanal sozlamalari (faqat admin)
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    const { data, error } = await supabaseAdmin.from("channel_settings").select("name, avatar_url, bio, username, updated_at").eq("id", 1).maybeSingle();
    if (error) throw error;
    return NextResponse.json(data || { name: "TrainerTop", avatar_url: null, bio: null, username: null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Admin channel GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// PUT /api/admin/channel — { name, avatar_url?, bio?, username? } (faqat admin)
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name : null;
    const avatar = typeof body.avatar_url === "string" ? body.avatar_url : null;
    const bio = typeof body.bio === "string" ? body.bio : null;
    const username = typeof body.username === "string" ? body.username : null;

    const { data, error } = await supabaseAdmin.rpc("channel_settings_update", { p_admin: admin.id, p_name: name, p_avatar: avatar, p_bio: bio, p_username: username });
    if (error) {
      const key = Object.keys(ERRORS).find((k) => String(error.message || "").includes(k));
      if (key) return NextResponse.json({ message: ERRORS[key][1] }, { status: ERRORS[key][0] });
      throw error;
    }
    await logAdmin(admin.id, "channel_settings_update", "channel", "1", { name: data?.name, username: data?.username });
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error("Admin channel PUT:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
