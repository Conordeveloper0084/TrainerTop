import { supabaseAdmin } from "@/lib/supabase/admin";

// Foydalanuvchining shu darslikda FAOL xaridi bormi: status='paid' va (umrbod yoki oylik bo'lsa
// muddati tugamagan). `GET /api/lessons?purchased=true` va `GET /api/lessons/[id]` (is_purchased)
// bilan BIR XIL qoida: `expires_at` yo'q oylik xarid faol hisoblanadi.
export async function hasActivePurchase(userId: string, lessonId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("purchases").select("purchase_type, expires_at")
    .eq("user_id", userId).eq("lesson_id", lessonId).eq("status", "paid");
  if (error) throw error;
  const now = Date.now();
  return (data || []).some((p: any) => !(p.purchase_type === "monthly" && p.expires_at && new Date(p.expires_at).getTime() <= now));
}
