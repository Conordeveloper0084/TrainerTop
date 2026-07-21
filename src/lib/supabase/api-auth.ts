import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

/**
 * Universal auth helper — HAM website (cookie) HAM mobil app (Bearer token) uchun.
 *
 * Website foydalanuvchisi cookie orqali keladi.
 * Android/iOS app esa "Authorization: Bearer <access_token>" header orqali keladi.
 *
 * Bu funksiya request'da Bearer token bo'lsa — undan, bo'lmasa cookie'dan
 * foydalanib autentifikatsiya qilingan Supabase client qaytaradi.
 */
export function createApiSupabaseClient(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;

  // App'dan kelgan Bearer token bo'lsa — global header bilan client yaratamiz
  if (token) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );
  }

  // Website — cookie orqali
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => {
          try {
            c.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component ichida set qilsa xato beradi — normal
          }
        },
      },
    }
  );
}

/**
 * Joriy autentifikatsiya qilingan foydalanuvchini qaytaradi (cookie yoki Bearer).
 * Foydalanuvchi yo'q bo'lsa null qaytaradi.
 */
export async function getApiUser(request: NextRequest) {
  const supabase = createApiSupabaseClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
