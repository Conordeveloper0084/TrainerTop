import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { buildLinks, clientIpKey, deviceKey, getTelegramConfig, hashSecret, newPollSecret, PLATFORMS, POLL_INTERVAL_MS } from "@/lib/telegram-login";

const NO_STORE = { "Cache-Control": "no-store" };

// POST /api/auth/telegram/link/start  { platform, device_id? }   (Bearer yoki cookie MAJBURIY)
// Mavjud /start bilan bir xil javob (+ mode: "link"), lekin so'rov "link" turida va JORIY foydalanuvchiga bog'langan.
// Sessiya BERILMAYDI (foydalanuvchi allaqachon kirgan). Akkauntga Telegram allaqachon ulangan bo'lsa — 409 ALREADY_LINKED.
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ code: "UNAUTHORIZED", message: "Login kerak" }, { status: 401, headers: NO_STORE });

    const cfg = getTelegramConfig();
    if (!cfg.token || !cfg.botUsername) return NextResponse.json({ code: "TELEGRAM_NOT_CONFIGURED", message: "Telegram orqali kirish hozircha sozlanmagan" }, { status: 503, headers: NO_STORE });

    const body = await request.json().catch(() => ({}));
    const platform = body?.platform;
    if (!PLATFORMS.includes(platform)) return NextResponse.json({ code: "BAD_PLATFORM", message: "platform: android | ios | web" }, { status: 400, headers: NO_STORE });

    const { data: existing } = await supabaseAdmin.from("telegram_accounts").select("username").eq("user_id", user.id).maybeSingle();
    if (existing) return NextResponse.json({ code: "ALREADY_LINKED", message: "Akkauntingizga Telegram allaqachon ulangan", telegram: { username: existing.username ?? null } }, { status: 409, headers: NO_STORE });

    const secret = newPollSecret();
    const { data, error } = await supabaseAdmin.rpc("tg_link_start", { p_secret_hash: hashSecret(secret), p_platform: platform, p_user_id: user.id, p_ip_key: clientIpKey(request.headers), p_device_key: deviceKey(body?.device_id) });
    if (error) {
      if ((error.message || "").includes("RATE_LIMITED")) return NextResponse.json({ code: "RATE_LIMITED", message: "Juda ko'p urinish. Bir necha daqiqadan keyin qayta urinib ko'ring", retry_after: 60 }, { status: 429, headers: { ...NO_STORE, "Retry-After": "60" } });
      throw error;
    }
    const row: any = Array.isArray(data) ? data[0] : data;
    if (!row?.id) throw new Error("tg_link_start: qator qaytmadi");
    const expiresIn = Math.max(0, Math.round((Date.parse(row.expires_at) - Date.now()) / 1000));
    return NextResponse.json({ mode: "link", login_id: row.id, poll_secret: secret, expires_at: row.expires_at, expires_in: expiresIn, poll_interval_ms: POLL_INTERVAL_MS, ...buildLinks(cfg.botUsername, row.id) }, { headers: NO_STORE });
  } catch (error: any) {
    console.error("Telegram link start:", error?.message || error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Server xatolik" }, { status: 500, headers: NO_STORE });
  }
}
