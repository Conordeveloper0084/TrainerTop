import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BAN_MESSAGE, hashSecret, isValidLoginId, isValidPollSecret } from "@/lib/telegram-login";
import { getPublicUser, issueSession, SessionError } from "@/lib/telegram-auth";

const NO_STORE = { "Cache-Control": "no-store" };

// GET /api/auth/telegram/status?login_id=<uuid>&poll_secret=<43 belgi>
//   200 { status: "pending" | "expired" | "cancelled" | "consumed" }     — tokensiz
//   200 { status: "confirmed", access_token, refresh_token, expires_in, expires_at, token_type, user, is_new_user }
//       — FAQAT BIR MARTA (so'rov atomik "consumed" qilinadi; keyingi so'rovlar "consumed" oladi)
//   400 BAD_REQUEST (parametr shakli noto'g'ri) · 404 NOT_FOUND (login_id yo'q YOKI poll_secret noto'g'ri — farqlanmaydi)
//   403 ACCOUNT_BANNED · 503 SESSION_FAILED (vaqtincha; so'rov qayta olinadigan holatga qaytariladi — yana so'rang)
// Sessiya tokenlari bazada saqlanmaydi: tasdiqlashda faqat "kim" saqlanadi, tokenlar shu yerda, sirni ko'rsatganda yaratiladi.
export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams;
    const loginId = sp.get("login_id"), secret = sp.get("poll_secret");
    if (!isValidLoginId(loginId) || !isValidPollSecret(secret)) return NextResponse.json({ code: "BAD_REQUEST", message: "login_id va poll_secret noto'g'ri" }, { status: 400, headers: NO_STORE });

    const { data, error } = await supabaseAdmin.rpc("tg_login_consume", { p_login_id: loginId, p_secret_hash: hashSecret(secret) });
    if (error) throw error;
    const r: any = Array.isArray(data) ? data[0] : data;
    if (!r || r.outcome === "not_found") return NextResponse.json({ code: "NOT_FOUND", message: "So'rov topilmadi" }, { status: 404, headers: NO_STORE });
    if (r.outcome !== "claimed") return NextResponse.json({ status: r.outcome }, { headers: NO_STORE });   // pending | expired | cancelled | consumed

    // Sessiya huquqi shu chaqiruvda qo'lga kiritildi (atomik) — endi tokenlar yaratiladi
    try {
      const session = await issueSession(r.user_id);
      const user = await getPublicUser(r.user_id);
      return NextResponse.json({ status: "confirmed", ...session, user, is_new_user: !!r.is_new_user }, { headers: NO_STORE });
    } catch (e: any) {
      if (e instanceof SessionError && e.code === "BANNED") return NextResponse.json({ code: "ACCOUNT_BANNED", message: BAN_MESSAGE }, { status: 403, headers: NO_STORE });
      // Token berilmadi — so'rovni qayta olish mumkin holatga qaytaramiz (mijoz yana so'raydi)
      console.error("Telegram sessiya:", e?.code || "", e?.message || e);
      try { await supabaseAdmin.rpc("tg_login_release", { p_login_id: loginId }); } catch { /* release muvaffaqiyatsiz bo'lsa ham javob 503 */ }
      return NextResponse.json({ code: "SESSION_FAILED", message: "Sessiya yaratib bo'lmadi. Qayta urinib ko'ring", retry: true }, { status: 503, headers: NO_STORE });
    }
  } catch (error: any) {
    console.error("Telegram status:", error?.message || error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Server xatolik" }, { status: 500, headers: NO_STORE });
  }
}
