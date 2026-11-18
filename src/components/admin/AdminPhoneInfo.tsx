"use client";

import { Phone, AlertTriangle } from "lucide-react";

// Admin panel: foydalanuvchi/trener kartasida TO'LIQ telefon raqam, manbasi, eski raqamlar va to'qnashuv belgisi.
// (Oddiy foydalanuvchilarga raqam hech qachon ko'rsatilmaydi — bu komponent faqat /admin ichida.)
export const SOURCE_LABEL: Record<string, string> = { telegram: "Telegram", sms: "SMS" };
export const CONFLICT_LABEL: Record<string, string> = {
  telegram_account_vs_phone_owner: "Telegram shu akkauntga ulangan, lekin ulashilgan raqam boshqa akkauntga tegishli",
  phone_owner_has_other_telegram: "Raqam shu akkauntga tegishli, lekin boshqa Telegram uni ulashga urindi",
};
const fmt = (s: string) => new Date(s).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" });

export function phoneLabel(u: { phone?: string | null; phone_source?: string | null }): string {
  return u.phone ? `${u.phone} · ${SOURCE_LABEL[u.phone_source || ""] || u.phone_source || "?"} · tasdiqlangan` : "Raqam yo'q";
}

export default function AdminPhoneInfo({ u, withLabel = true }: { u: any; withLabel?: boolean }) {
  const conflicts: any[] = u.phone_conflicts || [], history: any[] = u.phone_history || [];
  return (
    <div className="text-[11px] mt-1 space-y-0.5" data-testid="admin-phone">
      {withLabel && <p className={u.phone ? "text-white/60 flex items-center gap-1" : "text-white/30 flex items-center gap-1"} data-testid="admin-phone-line"><Phone className="h-3 w-3 shrink-0" />{phoneLabel(u)}</p>}
      {conflicts.length > 0 && (
        <p className="text-amber-300/90 flex items-start gap-1" data-testid="admin-phone-conflict"><AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /><span>Raqam to'qnashuvi ({conflicts.reduce((n, c) => n + (c.seen_count || 1), 0)}): {CONFLICT_LABEL[conflicts[0].kind] || conflicts[0].kind} ({conflicts[0].phone})</span></p>
      )}
      {history.length > 0 && <p className="text-white/30" data-testid="admin-phone-history">Eski raqamlar: {history.map((h) => `${h.phone} (${SOURCE_LABEL[h.source || ""] || h.source || "?"}, ${fmt(h.replaced_at)})`).join("; ")}</p>}
    </div>
  );
}
