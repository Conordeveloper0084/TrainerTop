"use client";

import { CheckCircle, X, Clock } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { formatCard } from "@/lib/card";

const STATUS = {
  completed: { label: "O'tkazildi", color: "text-lime", bg: "bg-lime/10", icon: CheckCircle },
  rejected: { label: "Rad etildi", color: "text-red-400", bg: "bg-red-500/10", icon: X },
  pending: { label: "Kutilmoqda", color: "text-yellow-500", bg: "bg-yellow-500/10", icon: Clock },
} as const;

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2">
      <p className="text-[11px] text-white/40 shrink-0 mr-3">{label}</p>
      <p className={cn("text-xs text-white/80 text-right", mono && "font-mono")}>{value}</p>
    </div>
  );
}

const dt = (s: string) =>
  new Date(s).toLocaleString("uz-UZ", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Pul yechish "cheki": holat, karta, sana va admin xabari (rad etilgan bo'lsa sabab)
export function PayoutDetailsModal({ payout, onClose }: { payout: any; onClose: () => void }) {
  const info = STATUS[payout.status as keyof typeof STATUS] || STATUS.pending;
  const Icon = info.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="text-center mb-6">
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3", info.bg)}>
              <Icon className={cn("h-8 w-8", info.color)} />
            </div>
            <p className={cn("text-xs font-semibold uppercase tracking-wider", info.color)}>{info.label}</p>
            <p className="text-3xl font-bold mt-2">{formatPrice(payout.amount)}</p>
          </div>

          <div className="border-y border-dashed border-white/[0.08] py-4 mb-4">
            <Row label="Operatsiya ID" value={String(payout.id).slice(0, 8).toUpperCase()} mono />
            <Row label="Karta raqami" value={formatCard(payout.card_number || "")} mono />
            {payout.card_holder && <Row label="Karta egasi" value={payout.card_holder} />}
            <Row label="Yuborilgan sana" value={dt(payout.requested_at)} />
            {payout.completed_at && <Row label={payout.status === "completed" ? "O'tkazilgan sana" : "Rad etilgan sana"} value={dt(payout.completed_at)} />}
          </div>

          {payout.status === "rejected" && (
            <div className="rounded-lg p-3 mb-4 border bg-red-500/[0.04] border-red-500/20">
              <p className="text-[10px] text-red-400/80 mb-1 uppercase tracking-wider">Rad etish sababi</p>
              <p className="text-xs text-white/80">{payout.admin_note || "Sabab ko'rsatilmagan"}</p>
              <p className="text-[11px] text-lime/80 mt-2">Summa balansingizga qaytarildi. Ma'lumotlarni to'g'rilab, qayta so'rov yuborishingiz mumkin.</p>
            </div>
          )}
          {payout.status === "completed" && payout.admin_note && (
            <div className="rounded-lg p-3 mb-4 border bg-white/[0.02] border-white/[0.06]">
              <p className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">Admin xabari</p>
              <p className="text-xs text-white/70">{payout.admin_note}</p>
            </div>
          )}
          {payout.status === "pending" && (
            <div className="bg-yellow-500/[0.04] border border-yellow-500/20 rounded-lg p-3 mb-4">
              <p className="text-[11px] text-yellow-500/80 leading-relaxed">
                So'rovingiz ko'rib chiqilmoqda. Summa balansingizdan ushlab qolingan; rad etilsa qaytariladi. Odatda 1–3 ish kuni ichida bajariladi.
              </p>
            </div>
          )}
          {payout.status === "completed" && (
            <div className="bg-lime/[0.04] border border-lime/20 rounded-lg p-3 mb-4">
              <p className="text-[11px] text-lime/80 leading-relaxed">Pul kartangizga o'tkazildi. Kelmagan bo'lsa, support bilan bog'laning.</p>
            </div>
          )}

          <button onClick={onClose} className="btn-outline w-full text-sm">Yopish</button>
        </div>
      </div>
    </div>
  );
}
