import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { safeRedirect } from "@/lib/redirect";
import { ensureProfile, becomeTrainer } from "@/lib/auth-server";

// Google (OAuth) qaytish manzili.
// ?code=...            Supabase bergan kod
// ?redirect=/yo'l      kirgach qaytiladigan ichki yo'l (faqat "/" bilan boshlanadigan)
// ?role=trainer        "Trener sifatida" kirilgan bo'lsa — YANGI akkaunt trener qilinadi
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = safeRedirect(searchParams.get("redirect"), "");
  const wantTrainer = searchParams.get("role") === "trainer";

  // Foydalanuvchi Google oynasida "Bekor qilish"ni bosgan
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?error=google_cancelled`);
  }

  if (code) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      let dest = redirect || "/";
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          const { created } = await ensureProfile(user);
          // "Yangi" = hozirgina ochilgan akkaunt (mavjud akkauntlar roli login orqali o'zgarmaydi)
          const fresh = created || Date.now() - new Date(user.created_at).getTime() < 5 * 60 * 1000;

          if (wantTrainer && fresh) {
            const r = await becomeTrainer(user.id);
            if (r.role === "trainer") dest = "/profile/setup";
          } else if (fresh && !redirect) {
            dest = "/trainers";
          }
        } catch (e) {
          console.error("auth/callback post-login:", e);
        }
      }
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
