import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/redirect";

const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "invite", "magiclink", "email_change"];

// Email'dagi tasdiqlash havolasi shu yerga keladi:
//   /auth/confirm?token_hash=...&type=email&next=/auth/confirmed
// token_hash usuli havolani BOSHQA qurilmada (masalan telefonda) ochsa ham ishlaydi.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirect(searchParams.get("next"), "/auth/confirmed");

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = createServerSupabaseClient();

    let { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    // Supabase versiyasiga qarab tasdiqlash xatining turi "email" yoki "signup" bo'lishi mumkin
    if (error && (type === "email" || type === "signup")) {
      const alt: EmailOtpType = type === "email" ? "signup" : "email";
      ({ error } = await supabase.auth.verifyOtp({ type: alt, token_hash: tokenHash }));
    }

    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
}
