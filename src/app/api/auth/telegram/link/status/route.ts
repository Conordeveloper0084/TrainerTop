import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { hashSecret, isValidLoginId, isValidPollSecret, LINK_CONFLICT_MESSAGES } from "@/lib/telegram-login";

const NO_STORE = { "Cache-Control": "no-store" };

// GET /api/auth/telegram/link/status?login_id=<uuid>&poll_secret=<43 belgi>   (Bearer yoki cookie MAJBURIY)
//   200 { status: "pending" | "expired" | "cancelled" }
//   200 { status: "linked", telegram: { username }, merged_empty_account: bool }   — ulandi (bo'sh dublikat o'chirilgan bo'lsa merged_empty_account=true)
//   200 { status: "conflict", code: "TELEGRAM_TAKEN" | "USER_HAS_TELEGRAM", message }   — hech narsa o'zgarmagan
//   404 NOT_FOUND — login_id yo'q / sir noto'g'ri / so'rov boshqa foydalanuvchiniki / bu ulash so'rovi emas (farqlanmaydi)
// Sessiya BERMAYDI. Holatlarni takror so'rash xavfsiz (hech narsa iste'mol qilinmaydi).
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ code: "UNAUTHORIZED", message: "Login kerak" }, { status: 401, headers: NO_STORE });
    const sp = new URL(request.url).searchParams;
    const loginId = sp.get("login_id"), secret = sp.get("poll_secret");
    if (!isValidLoginId(loginId) || !isValidPollSecret(secret)) return NextResponse.json({ code: "BAD_REQUEST", message: "login_id va poll_secret noto'g'ri" }, { status: 400, headers: NO_STORE });

    const { data, error } = await supabaseAdmin.rpc("tg_link_status", { p_login_id: loginId, p_secret_hash: hashSecret(secret), p_user_id: user.id });
    if (error) throw error;
    const r: any = Array.isArray(data) ? data[0] : data;
    if (!r || r.outcome === "not_found") return NextResponse.json({ code: "NOT_FOUND", message: "So'rov topilmadi" }, { status: 404, headers: NO_STORE });
    if (r.outcome === "linked") return NextResponse.json({ status: "linked", telegram: { username: r.username ?? null }, merged_empty_account: !!r.replaced }, { headers: NO_STORE });
    if (r.outcome === "conflict") return NextResponse.json({ status: "conflict", code: r.code, message: LINK_CONFLICT_MESSAGES[r.code] || LINK_CONFLICT_MESSAGES.TELEGRAM_TAKEN }, { headers: NO_STORE });
    return NextResponse.json({ status: r.outcome }, { headers: NO_STORE });     // pending | expired | cancelled
  } catch (error: any) {
    console.error("Telegram link status:", error?.message || error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Server xatolik" }, { status: 500, headers: NO_STORE });
  }
}
