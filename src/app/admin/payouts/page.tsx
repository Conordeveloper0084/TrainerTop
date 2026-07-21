"use client";

import { useEffect, useState } from "react";
import { Wallet, Check, X, Loader2, Clock, CheckCircle2, XCircle, Copy, AlertTriangle, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatPrice, getInitials, cn } from "@/lib/utils";

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [confirmAction, setConfirmAction] = useState<{ type: "complete" | "reject"; payout: any } | null>(null);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/payouts?${params}`);
      if (res.ok) setPayouts(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchPayouts(); }, [statusFilter]);

  const copyCard = (card: string) => {
    navigator.clipboard.writeText(card);
    toast.success("Karta raqami nusxalandi");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold mb-1">Pul yechish</h1>
        <p className="text-sm text-white/40">Trenerlar pul yechish requestlari</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto">
        <FilterBtn active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")} icon={Clock}>Kutilmoqda</FilterBtn>
        <FilterBtn active={statusFilter === "completed"} onClick={() => setStatusFilter("completed")} icon={CheckCircle2}>O'tkazilgan</FilterBtn>
        <FilterBtn active={statusFilter === "rejected"} onClick={() => setStatusFilter("rejected")} icon={XCircle}>Rad etilgan</FilterBtn>
        <FilterBtn active={statusFilter === ""} onClick={() => setStatusFilter("")}>Hammasi</FilterBtn>
      </div>

      {/* Ro'yxat */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>
      ) : payouts.length === 0 ? (
        <div className="card p-10 text-center">
          <Wallet className="h-10 w-10 text-white/10 mx-auto mb-3" />
          <p className="text-sm text-white/40">Request yo'q</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center shrink-0 overflow-hidden">
                    {p.trainer?.avatar_url ? <img src={p.trainer.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(p.trainer?.full_name || "")}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.trainer?.full_name}</p>
                    <p className="text-[11px] text-white/40 truncate">{p.trainer?.email}</p>
                    <p className="text-[10px] text-white/30 mt-1">
                      {new Date(p.requested_at).toLocaleString("uz-UZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <p className="text-xl font-bold text-lime">{formatPrice(p.amount)}</p>
                  <button onClick={() => copyCard(p.card_number)} className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-lime font-mono">
                    <Copy className="h-3 w-3" />{p.card_number?.replace(/(\d{4})/g, "$1 ").trim()}
                  </button>
                  {p.card_holder && <p className="text-[10px] text-white/30">{p.card_holder}</p>}
                </div>
              </div>

              {p.admin_note && (
                <div className="mt-3 pt-3 border-t border-white/[0.04]">
                  <p className="text-[10px] text-white/30 mb-1">Sabab:</p>
                  <p className="text-xs text-white/60">{p.admin_note}</p>
                </div>
              )}

              {p.status === "pending" && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-white/[0.04]">
                  <button onClick={() => setConfirmAction({ type: "complete", payout: p })}
                    className="flex-1 flex items-center justify-center gap-2 bg-lime text-black font-semibold py-2.5 rounded-lg text-sm hover:brightness-110 transition-all">
                    <Check className="h-4 w-4" />O'tkazdim
                  </button>
                  <button onClick={() => setConfirmAction({ type: "reject", payout: p })}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 py-2.5 rounded-lg text-sm hover:bg-red-500/20 transition-all">
                    <X className="h-4 w-4" />Rad etish
                  </button>
                </div>
              )}

              {p.status !== "pending" && (
                <div className="mt-3 pt-3 border-t border-white/[0.04]">
                  <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full",
                    p.status === "completed" ? "bg-lime-muted text-lime" : "bg-red-500/10 text-red-400")}>
                    {p.status === "completed" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {p.status === "completed" ? "O'tkazilgan" : "Rad etilgan"}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmAction && (
        <ConfirmActionModal
          action={confirmAction}
          onClose={() => setConfirmAction(null)}
          onDone={() => { setConfirmAction(null); fetchPayouts(); }}
        />
      )}
    </div>
  );
}

// ====== 2-BOSQICHLI TASDIQLASH MODAL ======
function ConfirmActionModal({ action, onClose, onDone }: any) {
  const [step, setStep] = useState(1);
  const [rejectNote, setRejectNote] = useState("");
  const [sending, setSending] = useState(false);
  const { type, payout } = action;
  const isComplete = type === "complete";

  const handleSubmit = async () => {
    if (!isComplete && !rejectNote.trim()) {
      toast.error("Rad etish sababini yozing");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/admin/payouts/${payout.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: isComplete ? "completed" : "rejected",
          note: isComplete ? null : rejectNote.trim(),
        }),
      });
      if (res.ok) {
        toast.success(isComplete ? "O'tkazilgan deb belgilandi" : "Rad etildi");
        onDone();
      } else toast.error("Xatolik");
    } catch { toast.error("Xatolik"); } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className={cn("p-5 border-b border-white/[0.04] flex items-center gap-3",
          isComplete ? "bg-lime/[0.04]" : "bg-red-500/[0.04]")}>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            isComplete ? "bg-lime/20" : "bg-red-500/20")}>
            {isComplete ? <Check className={cn("h-5 w-5 text-lime")} /> : <AlertTriangle className="h-5 w-5 text-red-400" />}
          </div>
          <div>
            <h2 className="text-base font-bold">
              {isComplete ? (step === 1 ? "Tasdiqlang" : "Yana bir bor tekshiring") : "Rad etish"}
            </h2>
            <p className="text-[11px] text-white/40 mt-0.5">
              {isComplete ? `Qadam ${step}/2` : "Trenerga sabab ko'rsatiladi"}
            </p>
          </div>
        </div>

        <div className="p-5">
          {/* COMPLETE — STEP 1: ASOSIY MA'LUMOT */}
          {isComplete && step === 1 && (
            <>
              <p className="text-sm text-white/70 mb-4 leading-relaxed">
                Quyidagi trenerga pul o'tkazganingizni tasdiqlaysizmi?
              </p>

              <div className="bg-dark-card rounded-xl p-4 space-y-3 mb-4">
                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.04]">
                  <div className="w-10 h-10 rounded-full bg-dark-elevated flex items-center justify-center shrink-0 overflow-hidden">
                    {payout.trainer?.avatar_url ? <img src={payout.trainer.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/30">{getInitials(payout.trainer?.full_name || "")}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{payout.trainer?.full_name}</p>
                    <p className="text-[11px] text-white/40 truncate">{payout.trainer?.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Summa</span>
                  <span className="text-base font-bold text-lime">{formatPrice(payout.amount)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Karta</span>
                  <span className="text-xs font-mono text-white/80">
                    {payout.card_number?.replace(/(\d{4})/g, "$1 ").trim()}
                  </span>
                </div>

                {payout.card_holder && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">Egasi</span>
                    <span className="text-xs text-white/80">{payout.card_holder}</span>
                  </div>
                )}
              </div>

              <div className="bg-yellow-500/[0.06] border border-yellow-500/20 rounded-lg p-3 mb-5 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-yellow-500/90 leading-relaxed">
                  Tasdiqlashdan oldin bank ilovangizda pul o'tganini tekshiring. Bu amalni qaytarib bo'lmaydi.
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={onClose} className="btn-outline flex-1 !py-2.5 text-sm">Bekor qilish</button>
                <button onClick={() => setStep(2)} className="btn-lime flex-1 !py-2.5 text-sm">
                  Davom etish →
                </button>
              </div>
            </>
          )}

          {/* COMPLETE — STEP 2: AKMALGA 150 MING SO'M *** KARTAGA O'TKAZILDIMI? */}
          {isComplete && step === 2 && (
            <>
              <p className="text-base text-white/90 mb-2 leading-relaxed text-center font-semibold">
                <span className="text-lime">{payout.trainer?.full_name?.split(" ")[0]}</span>'ga{" "}
                <span className="text-lime">{formatPrice(payout.amount)}</span>
              </p>
              <p className="text-sm text-white/60 text-center mb-1">
                <span className="font-mono text-white/80">**** {payout.card_number?.slice(-4)}</span> kartaga
              </p>
              <p className="text-base text-white/90 text-center mb-5 font-semibold">
                <span className="text-lime">o'tkazildimi?</span>
              </p>

              <div className="bg-red-500/[0.04] border border-red-500/20 rounded-lg p-3 mb-5 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-400/90 leading-relaxed">
                  <strong>Diqqat:</strong> Faqat haqiqatdan ham pul o'tkazgan bo'lsangiz "Ha, o'tkazildi" tugmasini bosing. Aks holda trener noto'g'ri xabar oladi va balansidan pul yo'qoladi.
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} disabled={sending} className="btn-outline flex-1 !py-2.5 text-sm">← Orqaga</button>
                <button onClick={handleSubmit} disabled={sending} className="btn-lime flex-1 !py-2.5 text-sm disabled:opacity-30">
                  {sending ? "Yuborilmoqda..." : "Ha, o'tkazildi"}
                </button>
              </div>
            </>
          )}

          {/* REJECT */}
          {!isComplete && (
            <>
              <p className="text-sm text-white/70 mb-4 leading-relaxed">
                Quyidagi requestni rad etyapsiz. Pul trenerning balansiga qaytariladi.
              </p>

              <div className="bg-dark-card rounded-xl p-4 space-y-2 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-dark-elevated flex items-center justify-center shrink-0 overflow-hidden">
                    {payout.trainer?.avatar_url ? <img src={payout.trainer.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/30">{getInitials(payout.trainer?.full_name || "")}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{payout.trainer?.full_name}</p>
                    <p className="text-[11px] text-white/40">{formatPrice(payout.amount)}</p>
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-xs text-white/60 mb-2">Sababi <span className="text-red-400">*</span></label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Misol: Karta raqami noto'g'ri, qayta urinib ko'ring"
                  rows={3}
                  className="input-field resize-none"
                  autoFocus
                />
                <p className="text-[10px] text-white/30 mt-1.5">Bu xabar trenerga ko'rinadi</p>
              </div>

              <div className="flex gap-2">
                <button onClick={onClose} disabled={sending} className="btn-outline flex-1 !py-2.5 text-sm">Bekor qilish</button>
                <button onClick={handleSubmit} disabled={sending || !rejectNote.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-500/20 transition-all disabled:opacity-30">
                  {sending ? "Yuborilmoqda..." : "Rad etish"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterBtn({ children, active, onClick, icon: Icon }: any) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
      active ? "bg-lime text-black" : "bg-dark-surface border border-white/[0.08] text-white/60 hover:bg-white/5")}>
      {Icon && <Icon className="h-3 w-3" />}{children}
    </button>
  );
}
