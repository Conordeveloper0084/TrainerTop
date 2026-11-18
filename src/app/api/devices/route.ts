import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

const PLATFORMS = ["android", "ios", "web"];
const TOKEN_MAX = 2048;   // FCM tokenlari ~160-200 belgi; Web Push endpoint URL'lari uzunroq bo'lishi mumkin

// Ikkala usul uchun umumiy: tanadagi token (matn, bo'sh emas, chegarada). Web Push uchun bu —
// pushManager.subscribe() natijasidagi "endpoint" manzili (har bir obuna uchun noyob URL).
function readToken(body: any): string | null {
  const t = typeof body?.token === "string" ? body.token.trim() : "";
  return t && t.length <= TOKEN_MAX ? t : null;
}

// Web Push uchun shifrlash kalitlari (PushSubscription.toJSON().keys) — base64url matn, bo'sh emas.
function readWebPushKeys(body: any): { p256dh: string; auth: string } | null {
  const k = body?.keys;
  const p256dh = typeof k?.p256dh === "string" ? k.p256dh.trim() : "";
  const auth = typeof k?.auth === "string" ? k.auth.trim() : "";
  return p256dh && auth && p256dh.length <= 256 && auth.length <= 64 ? { p256dh, auth } : null;
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

    let webPushKeys: { p256dh: string; auth: string } | null = null;
    if (platform === "web") {
      webPushKeys = readWebPushKeys(body);
      if (!webPushKeys) return NextResponse.json({ message: "keys (p256dh, auth) kerak" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("device_tokens").upsert(
      { user_id: user.id, token, platform, web_push_keys: webPushKeys, last_seen_at: new Date().toISOString() },
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
