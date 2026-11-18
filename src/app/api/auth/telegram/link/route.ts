import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { isSyntheticEmail } from "@/lib/synthetic-email";

const NO_STORE = { "Cache-Control": "no-store" };

// DELETE /api/auth/telegram/link — Telegram'ni akkauntdan UZISH (Bearer yoki cookie MAJBURIY).
// FAQAT akkauntda BOSHQA kirish usuli (haqiqiy email — email/Google/Apple) bo'lsa mumkin; aks holda foydalanuvchi akkauntdan
// chiqib ketadi: 409 LAST_LOGIN_METHOD. Ulanmagan bo'lsa — 404 NOT_LINKED.
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ code: "UNAUTHORIZED", message: "Login kerak" }, { status: 401, headers: NO_STORE });

    const { data: link } = await supabaseAdmin.from("telegram_accounts").select("telegram_user_id").eq("user_id", user.id).maybeSingle();
    if (!link) return NextResponse.json({ code: "NOT_LINKED", message: "Akkauntingizga Telegram ulanmagan" }, { status: 404, headers: NO_STORE });

    const { data: prof } = await supabaseAdmin.from("profiles").select("email").eq("id", user.id).maybeSingle();
    if (!prof || isSyntheticEmail(prof.email)) {
      return NextResponse.json({ code: "LAST_LOGIN_METHOD", message: "Telegram — akkauntingizdagi yagona kirish usuli. Avval email qo'shing." }, { status: 409, headers: NO_STORE });
    }
    const { error } = await supabaseAdmin.from("telegram_accounts").delete().eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (error: any) {
    console.error("Telegram unlink:", error?.message || error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Server xatolik" }, { status: 500, headers: NO_STORE });
  }
}
