import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

const PLATFORMS = ["android", "ios", "web"];
const TOKEN_MAX = 1024;   // FCM tokenlari ~160-200 belgi; bundan uzuni — noto'g'ri

// Ikkala usul uchun umumiy: tanadagi token (matn, bo'sh emas, chegarada)
function readToken(body: any): string | null {
  const t = typeof body?.token === "string" ? body.token.trim() : "";
  return t && t.length <= TOKEN_MAX ? t : null;
}

// POST /api/devices — { token, platform? } — FCM tokenini shu foydalanuvchiga bog'laydi (upsert).
// Token boshqa foydalanuvchida bo'lsa (qurilmada akkaunt almashdi) — yangisiga o'tkaziladi.
// Bearer (ilova) va cookie (sayt) auth ikkalasi ham ishlaydi.
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const token = readToken(body);
    if (!token) return NextResponse.json({ message: "Token kerak" }, { status: 400 });
    const rawPlatform = typeof body.platform === "string" ? body.platform.trim().toLowerCase() : "";
    const platform = rawPlatform || "android";
    if (!PLATFORMS.includes(platform)) return NextResponse.json({ message: "Noto'g'ri platforma" }, { status: 400 });

    const { error } = await supabaseAdmin.from("device_tokens").upsert(
      { user_id: user.id, token, platform, last_seen_at: new Date().toISOString() },
      { onConflict: "token" },
    );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Devices POST:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// DELETE /api/devices — { token } — FAQAT o'zining tokenini o'chiradi (chiqishda). Token yo'q bo'lsa ham
// muvaffaqiyat (idempotent). Ilova DELETE'ga JSON body yuboradi.
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const token = readToken(body);
    if (!token) return NextResponse.json({ message: "Token kerak" }, { status: 400 });

    const { error } = await supabaseAdmin.from("device_tokens").delete().eq("user_id", user.id).eq("token", token);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Devices DELETE:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
