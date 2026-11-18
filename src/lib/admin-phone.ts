import { supabaseAdmin } from "@/lib/supabase/admin";

// Admin panel uchun telefon yordamchilari. FAQAT admin route'larida ishlatiladi: admin to'liq raqamni ko'radi (maska emas).

// Qidiruv: raqamni "+998 90 123-45-67", "901234567" kabi yozish mumkin — faqat raqamlar solishtiriladi (kamida 4 ta).
// Natija: PostgREST .or() ga qo'shiladigan "phone.ilike.%…%" bo'lagi yoki null.
export function phoneSearchClause(search: string): string | null {
  const digits = (search || "").replace(/\D/g, "");
  return digits.length >= 4 && digits.length <= 15 ? `phone.ilike.%${digits}%` : null;
}

export interface PhoneConflictInfo { id: number; kind: string; phone: string; role: "logged_in" | "phone_owner"; other_user_id: string | null; telegram_user_id: number; seen_count: number; last_seen_at: string }
export interface PhoneHistoryInfo { phone: string; source: string | null; replaced_at: string }

// Har bir foydalanuvchiga: ochiq to'qnashuvlar (u kirilgan akkaunt yoki raqam egasi sifatida) va oxirgi 3 ta eski raqam
export async function attachPhoneInfo<T extends { id: string }>(rows: T[]): Promise<(T & { phone_conflicts: PhoneConflictInfo[]; phone_history: PhoneHistoryInfo[] })[]> {
  const ids = rows.map((r) => r.id);
  const conflicts = new Map<string, PhoneConflictInfo[]>(), history = new Map<string, PhoneHistoryInfo[]>();
  if (ids.length > 0) {
    const [byUser, byOwner, hist] = await Promise.all([
      supabaseAdmin.from("phone_conflicts").select("id, kind, phone, user_id, phone_owner_id, telegram_user_id, seen_count, last_seen_at").in("user_id", ids).is("resolved_at", null),
      supabaseAdmin.from("phone_conflicts").select("id, kind, phone, user_id, phone_owner_id, telegram_user_id, seen_count, last_seen_at").in("phone_owner_id", ids).is("resolved_at", null),
      supabaseAdmin.from("phone_history").select("user_id, phone, source, replaced_at").in("user_id", ids).order("replaced_at", { ascending: false }),
    ]);
    const push = (uid: string, c: any, role: "logged_in" | "phone_owner") => {
      const list = conflicts.get(uid) ?? []; if (list.some((x) => x.id === c.id && x.role === role)) return;
      list.push({ id: c.id, kind: c.kind, phone: c.phone, role, other_user_id: role === "logged_in" ? c.phone_owner_id ?? null : c.user_id, telegram_user_id: c.telegram_user_id, seen_count: c.seen_count, last_seen_at: c.last_seen_at });
      conflicts.set(uid, list);
    };
    for (const c of (byUser.data || []) as any[]) push(c.user_id, c, "logged_in");
    for (const c of (byOwner.data || []) as any[]) if (c.phone_owner_id && c.phone_owner_id !== c.user_id) push(c.phone_owner_id, c, "phone_owner");
    for (const h of (hist.data || []) as any[]) { const l = history.get(h.user_id) ?? []; if (l.length < 3) { l.push({ phone: h.phone, source: h.source ?? null, replaced_at: h.replaced_at }); history.set(h.user_id, l); } }
  }
  return rows.map((r) => ({ ...r, phone_conflicts: conflicts.get(r.id) ?? [], phone_history: history.get(r.id) ?? [] }));
}
