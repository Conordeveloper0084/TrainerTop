import { supabaseAdmin } from "@/lib/supabase/admin";

// Joriy ko'ruvchi (viewer) bloklagan foydalanuvchilar ro'yxati — FAQAT shu odamning o'z lentasida
// ular ko'rinmasligi uchun (ban'dan farqli o'laroq, bir tomonlama va shaxsiy: bloklangan odamning
// o'zi va boshqalar uchun hech narsa o'zgarmaydi). Kesh yo'q — har viewer uchun alohida, kam
// ma'lumot, tez so'rov.
export async function getBlockedUserIds(viewerId: string | null | undefined): Promise<string[]> {
  if (!viewerId) return [];
  try {
    const { data, error } = await supabaseAdmin.from("blocks").select("blocked_id").eq("blocker_id", viewerId);
    if (error) throw error;
    return (data || []).map((r: any) => r.blocked_id);
  } catch (error) {
    console.error("getBlockedUserIds:", error);
    return [];
  }
}
