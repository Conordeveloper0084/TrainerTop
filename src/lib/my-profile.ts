import type { SupabaseClient } from "@supabase/supabase-js";

// O'z profilimni olish. Email/telefon/balans kabi maxfiy ustunlar brauzerdan yopilgan (SQL v14b),
// shuning uchun o'z ma'lumotlarim `get_my_profile()` / `get_my_trainer_profile()` orqali keladi.
// Agar SQL hali ishga tushmagan bo'lsa (funksiya yo'q) — eski usul (select *) ishlatiladi, sayt buzilmaydi.

export function isMissingFunction(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || "");
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(msg);
}

export async function fetchMyProfile(supabase: SupabaseClient, userId: string): Promise<any | null> {
  const { data, error } = await supabase.rpc("get_my_profile");
  if (!error) return data ?? null;
  if (isMissingFunction(error)) {
    const r = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    return r.data ?? null;
  }
  return null;
}

export async function fetchMyTrainerProfile(supabase: SupabaseClient, userId: string): Promise<any | null> {
  const { data, error } = await supabase.rpc("get_my_trainer_profile");
  if (!error) return data ?? null;
  if (isMissingFunction(error)) {
    const r = await supabase.from("trainer_profiles").select("*").eq("user_id", userId).maybeSingle();
    return r.data ?? null;
  }
  return null;
}
