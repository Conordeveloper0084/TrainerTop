import { createClient } from "@supabase/supabase-js";

// Admin client — faqat server-side API route'larda ishlatiladi
// RLS bypass qiladi
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
