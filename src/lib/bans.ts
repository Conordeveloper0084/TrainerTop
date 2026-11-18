import { supabaseAdmin } from "@/lib/supabase/admin";

export interface ActiveBan {
  reason: string;
  expires_at: string | null; // null = doimiy
}

// Serverless instansiya ichida qisqa muddatli kesh (har API so'rovida DB'ga bormaslik uchun).
// Ban qo'yilgach eng ko'pi bilan TTL davomida eski holat ko'rinishi mumkin.
const USER_TTL_MS = 10_000;
const LIST_TTL_MS = 30_000;
const userCache = new Map<string, { at: number; ban: ActiveBan | null }>();
let listCache: { at: number; ids: string[] } | null = null;

export function invalidateBanCache() {
  userCache.clear();
  listCache = null;
}

// Foydalanuvchining amaldagi bani (bo'lsa). DB xatosida ban YO'Q deb hisoblanadi (xizmat to'xtab qolmasligi uchun).
export async function getActiveBan(userId: string): Promise<ActiveBan | null> {
  const hit = userCache.get(userId);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.ban;
  try {
    const { data, error } = await supabaseAdmin
      .from("user_bans")
      .select("reason, expires_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("banned_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const ban = data && data.length > 0 ? { reason: data[0].reason, expires_at: data[0].expires_at } : null;
    userCache.set(userId, { at: Date.now(), ban });
    return ban;
  } catch (e) {
    console.error("getActiveBan:", e);
    return null;
  }
}

// Ommaviy ro'yxatlarda (post, darslik, trener) yashirilishi kerak bo'lgan foydalanuvchilar
export async function getBannedUserIds(): Promise<string[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return listCache.ids;
  try {
    const { data, error } = await supabaseAdmin
      .from("user_bans")
      .select("user_id")
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .limit(1000);
    if (error) throw error;
    const ids = Array.from(new Set((data || []).map((r: any) => r.user_id as string)));
    listCache = { at: Date.now(), ids };
    return ids;
  } catch (e) {
    console.error("getBannedUserIds:", e);
    return [];
  }
}

// PostgREST `not.in` filtri uchun: ("id1","id2")
export function notInList(ids: string[]): string {
  return `(${ids.map((i) => `"${i}"`).join(",")})`;
}
