import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { sendEmail } from "@/lib/email";
import { escapeLike } from "@/lib/search";
import { isSyntheticEmail } from "@/lib/synthetic-email";
import { clientIpKey } from "@/lib/telegram-login";
import { emailCodeMessage, generateEmailCode, isValidPassword, normalizeEmail, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/email-add";
import { hmacCode, isSecretBoxConfigured, sealSecret } from "@/lib/secret-box";

const NO_STORE = { "Cache-Control": "no-store" };

// POST /api/account/email/start  { email, password }   (Bearer yoki cookie MAJBURIY)
// FAQAT Telegram orqali ochilgan (sintetik emailli) akkaunt uchun: emailga 6 xonali tasdiqlash kodi yuboriladi (10 daqiqa amal qiladi).
// Email boshqa akkauntda band bo'lsa — 409 EMAIL_TAKEN. Parol shu yerda tekshiriladi, tasdiqlanguncha bazada FAQAT shifrlangan holda turadi.
// Tezlik limiti: bir foydalanuvchi 3 ta / soat, bir IP 10 ta / soat. Keyingi qadam: POST /api/account/email/verify.
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ code: "UNAUTHORIZED", message: "Login kerak" }, { status: 401, headers: NO_STORE });
    if (!process.env.RESEND_API_KEY || !isSecretBoxConfigured()) return NextResponse.json({ code: "EMAIL_NOT_CONFIGURED", message: "Email qo'shish hozircha mavjud emas" }, { status: 503, headers: NO_STORE });

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    if (!email) return NextResponse.json({ code: "BAD_EMAIL", message: "Email noto'g'ri" }, { status: 400, headers: NO_STORE });
    if (!isValidPassword(body?.password)) return NextResponse.json({ code: "BAD_PASSWORD", message: `Parol ${PASSWORD_MIN}–${PASSWORD_MAX} belgidan iborat bo'lishi kerak` }, { status: 400, headers: NO_STORE });

    const { data: prof } = await supabaseAdmin.from("profiles").select("email").eq("id", user.id).maybeSingle();
    if (!prof) return NextResponse.json({ code: "SERVER_ERROR", message: "Server xatolik" }, { status: 500, headers: NO_STORE });
    if (!isSyntheticEmail(prof.email)) return NextResponse.json({ code: "EMAIL_ALREADY_SET", message: "Akkauntingizda email allaqachon bor" }, { status: 409, headers: NO_STORE });

    const { data: taken } = await supabaseAdmin.from("profiles").select("id").ilike("email", escapeLike(email)).limit(1);
    if (taken && taken.length > 0) return NextResponse.json({ code: "EMAIL_TAKEN", message: "Bu email boshqa akkauntda band" }, { status: 409, headers: NO_STORE });

    const code = generateEmailCode();
    const { data, error } = await supabaseAdmin.rpc("email_add_start", { p_user: user.id, p_email: email, p_code_hash: hmacCode(user.id, email, code), p_password_sealed: sealSecret(body.password), p_ip_key: clientIpKey(request.headers) });
    if (error) {
      if ((error.message || "").includes("RATE_LIMITED")) return NextResponse.json({ code: "RATE_LIMITED", message: "Juda ko'p urinish. Keyinroq qayta urinib ko'ring", retry_after: 3600 }, { status: 429, headers: { ...NO_STORE, "Retry-After": "3600" } });
      throw error;
    }
    const row: any = Array.isArray(data) ? data[0] : data;
    if (!row?.id) throw new Error("email_add_start: qator qaytmadi");

    const msg = emailCodeMessage(code);
    const sent = await sendEmail({ to: email, subject: msg.subject, text: msg.text });
    if (!sent.sent) {
      console.error("Email kodi yuborilmadi:", sent.reason);
      return NextResponse.json({ code: "EMAIL_SEND_FAILED", message: "Kodni yuborib bo'lmadi. Keyinroq qayta urinib ko'ring" }, { status: 502, headers: NO_STORE });
    }
    return NextResponse.json({ success: true, email, expires_in: Math.max(0, Math.round((Date.parse(row.expires_at) - Date.now()) / 1000)) }, { headers: NO_STORE });
  } catch (error: any) {
    console.error("Email add start:", error?.message || error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Server xatolik" }, { status: 500, headers: NO_STORE });
  }
}
