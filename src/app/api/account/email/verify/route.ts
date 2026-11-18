import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { escapeLike } from "@/lib/search";
import { isSyntheticEmail } from "@/lib/synthetic-email";
import { isValidCode, normalizeEmail } from "@/lib/email-add";
import { hmacCode, isSecretBoxConfigured, openSecret } from "@/lib/secret-box";

const NO_STORE = { "Cache-Control": "no-store" };
const TAKEN = /already|registered|exists|duplicate|taken/i;

// POST /api/account/email/verify  { email, code }   (Bearer yoki cookie MAJBURIY)
// Kod to'g'ri bo'lsa: sintetik email HAQIQIY email bilan almashtiriladi va start'da kiritilgan parol o'rnatiladi — shundan keyin
// foydalanuvchi email + parol bilan ham O'SHA akkauntga kiradi. Kod 5 martagacha urinish mumkin; 10 daqiqa amal qiladi; bir marta ishlaydi.
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ code: "UNAUTHORIZED", message: "Login kerak" }, { status: 401, headers: NO_STORE });
    if (!isSecretBoxConfigured()) return NextResponse.json({ code: "EMAIL_NOT_CONFIGURED", message: "Email qo'shish hozircha mavjud emas" }, { status: 503, headers: NO_STORE });

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    if (!email || !isValidCode(body?.code)) return NextResponse.json({ code: "BAD_REQUEST", message: "Email yoki kod noto'g'ri" }, { status: 400, headers: NO_STORE });

    const { data: prof } = await supabaseAdmin.from("profiles").select("email").eq("id", user.id).maybeSingle();
    if (!prof) return NextResponse.json({ code: "SERVER_ERROR", message: "Server xatolik" }, { status: 500, headers: NO_STORE });
    if (!isSyntheticEmail(prof.email)) return NextResponse.json({ code: "EMAIL_ALREADY_SET", message: "Akkauntingizda email allaqachon bor" }, { status: 409, headers: NO_STORE });

    const { data, error } = await supabaseAdmin.rpc("email_add_attempt", { p_user: user.id, p_email: email, p_code_hash: hmacCode(user.id, email, body.code) });
    if (error) throw error;
    const r: any = Array.isArray(data) ? data[0] : data;
    if (!r || r.outcome === "no_request") return NextResponse.json({ code: "NO_PENDING_REQUEST", message: "Avval kod so'rang" }, { status: 400, headers: NO_STORE });
    if (r.outcome === "expired") return NextResponse.json({ code: "CODE_EXPIRED", message: "Kod eskirgan. Yangi kod so'rang" }, { status: 400, headers: NO_STORE });
    if (r.outcome === "too_many") return NextResponse.json({ code: "TOO_MANY_ATTEMPTS", message: "Juda ko'p noto'g'ri urinish. Yangi kod so'rang" }, { status: 429, headers: NO_STORE });
    if (r.outcome === "bad_code") return NextResponse.json({ code: "BAD_CODE", message: "Kod noto'g'ri", attempts_left: r.attempts_left }, { status: 400, headers: NO_STORE });
    if (r.outcome !== "ok") throw new Error("email_add_attempt: kutilmagan natija");

    // Kod to'g'ri. Endi almashtirish; vaqtincha xatoda so'rov qayta ishlatiladigan holatga qaytariladi (release).
    const release = async () => { try { await supabaseAdmin.rpc("email_add_release", { p_request: r.request_id }); } catch { /* e'tiborsiz */ } };
    try {
      const { data: taken } = await supabaseAdmin.from("profiles").select("id").ilike("email", escapeLike(email)).neq("id", user.id).limit(1);
      if (taken && taken.length > 0) return NextResponse.json({ code: "EMAIL_TAKEN", message: "Bu email boshqa akkauntda band" }, { status: 409, headers: NO_STORE });

      const password = openSecret(r.password_sealed);
      const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, { email, password, email_confirm: true });
      if (aErr) {
        if (TAKEN.test(aErr.message || "")) return NextResponse.json({ code: "EMAIL_TAKEN", message: "Bu email boshqa akkauntda band" }, { status: 409, headers: NO_STORE });
        throw aErr;
      }
      const { error: pErr } = await supabaseAdmin.from("profiles").update({ email }).eq("id", user.id);
      if (pErr) throw pErr;
    } catch (e: any) {
      console.error("Email almashtirish:", e?.message || e);
      await release();
      return NextResponse.json({ code: "SERVER_ERROR", message: "Server xatolik. Qayta urinib ko'ring" }, { status: 500, headers: NO_STORE });
    }
    return NextResponse.json({ success: true, email }, { headers: NO_STORE });
  } catch (error: any) {
    console.error("Email add verify:", error?.message || error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Server xatolik" }, { status: 500, headers: NO_STORE });
  }
}
