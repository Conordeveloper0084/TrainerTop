import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  // Session yangilash
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  // `fonts/` — shrift fayllari (public/fonts) session yangilashni KUTMASIN: middleware har so'rovda Supabase Auth'ga
  // tarmoq chaqiruvi qiladi, shrift esa sahifa chizilishini kechiktiradi (_next/static shrifti ham shu sababli chiqarib tashlangan).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|auth|fonts/).*)"],
};
