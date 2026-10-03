import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Foydalanuvchining profiles qatori borligiga ishonch hosil qiladi.
// Odatda uni DB trigger (handle_new_user) yaratadi; bu — zaxira. Google'dan kelgan
// ism va rasm ham shu yerda to'ldiriladi.
export async function ensureProfile(user: User): Promise<{ created: boolean }> {
  const meta: Record<string, any> = user.user_metadata || {};
  const fullName: string =
    meta.full_name || meta.name || (user.email ? user.email.split("@")[0] : "Foydalanuvchi");
  const avatar: string | null = meta.avatar_url || meta.picture || null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: user.id, email: user.email, full_name: fullName, avatar_url: avatar, role: "user" },
        { onConflict: "id", ignoreDuplicates: true }
      );
    await supabaseAdmin
      .from("user_profiles")
      .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
    return { created: true };
  }

  // Avatar bo'sh bo'lsa — Google rasmini qo'yamiz (mavjud rasmni hech qachon almashtirmaymiz)
  if (!profile.avatar_url && avatar) {
    await supabaseAdmin.from("profiles").update({ avatar_url: avatar }).eq("id", user.id);
  }
  return { created: false };
}

// Foydalanuvchini trener qiladi. Idempotent, admin rolini HECH QACHON o'zgartirmaydi.
// Qaytadi: { role: "trainer" | "admin" }
export async function becomeTrainer(userId: string): Promise<{ role: "trainer" | "admin" }> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) throw new Error("PROFILE_NOT_FOUND");
  if (profile.role === "admin") return { role: "admin" };

  if (profile.role !== "trainer") {
    // .eq("role","user") — parallel so'rovda admin bo'lib qolgan bo'lsa ustiga yozmaslik uchun
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role: "trainer" })
      .eq("id", userId)
      .eq("role", "user");
    if (error) throw error;
  }

  const { data: tp } = await supabaseAdmin
    .from("trainer_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!tp) {
    const { error } = await supabaseAdmin.from("trainer_profiles").insert({ user_id: userId });
    if (error && (error as any).code !== "23505") throw error; // 23505 = allaqachon bor
  }

  // Yakuniy holatni qayta o'qiymiz (admin bo'lib qolgan bo'lishi mumkin)
  const { data: after } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return { role: after?.role === "admin" ? "admin" : "trainer" };
}
