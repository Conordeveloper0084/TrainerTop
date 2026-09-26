"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { formatCard, normalizeHolder } from "@/lib/card";
import { validatePayoutForm } from "@/lib/payout-form";

interface Props {
  balance: number;
  minPayout: number;
  onClose: () => void;
  onDone: () => void;
}

// Pul yechish: karta va egasi HAR SAFAR kiritiladi (saqlanmaydi) — boshqa kartaga ham yechish mumkin.
// 2 bosqich: (1) ma'lumot kiritish, (2) tekshirib tasdiqlash.
export function PayoutModal({ balance, minPayout, onClose, onDone }: Props) {
  const [amount, setAmount] = useState("");
  const [card, setCard] = useState("");
  const [holder, setHolder] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);

  const v = validatePayoutForm({ amount, card, holder, balance, min: minPayout });
  const cardDigitsFull = v.cardDigits.length === 16;

  const goNext = () => {
    setTouched(true);
    if (!v.ok) return;
    setStep(2);
  };

  const submit = async () => {
    if (!v.ok || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: v.amountNum, card_number: v.cardDigits, card_holder: v.holderNorm }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("So'rov yuborildi. Summa balansingizdan ushlab qolindi");
        onDone();
      } else {
        toast.error(d.message || "Xatolik");
        if (d.code === "BAD_CARD" || d.code === "BAD_HOLDER") setStep(1);
      }
    } catch {
      toast.error("Internet bilan muammo. Qayta urinib ko'ring");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-1">Pul yechish</h2>
          <p className="text-xs text-white/40 mb-5">
            Balansda: <span className="text-lime font-semibold">{formatPrice(balance)}</span>
          </p>

          {step === 1 ? (
            <>
              <div className="mb-3">
                <label className="block text-xs text-white/60 mb-2">Summa (so'm)</label>
                <input
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder={String(minPayout)}
                  className="input-field"
                />
                {touched && v.errors.amount ? (
                  <p className="text-[11px] text-red-400 mt-1.5">{v.errors.amount}</p>
                ) : (
                  <p className="text-[10px] text-white/30 mt-1.5">Minimum {formatPrice(minPayout)}</p>
                )}
                <button
                  type="button"
                  onClick={() => setAmount(String(balance))}
                  className="w-full mt-2 px-3 py-2 rounded-lg bg-lime/10 border border-lime/30 text-xs text-lime font-semibold hover:bg-lime/20 transition-all"
                >
                  Hammasini yechish ({formatPrice(balance)})
                </button>
              </div>

              <div className="mb-3">
                <label className="block text-xs text-white/60 mb-2">Pul tushadigan karta raqami</label>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={formatCard(card)}
                  onChange={(e) => setCard(e.target.value)}
                  placeholder="8600 1234 5678 9012"
                  className="input-field font-mono text-sm"
                />
                {(touched || cardDigitsFull) && v.errors.card && <p className="text-[11px] text-red-400 mt-1.5">{v.errors.card}</p>}
              </div>

              <div className="mb-4">
                <label className="block text-xs text-white/60 mb-2">Karta egasi (kartadagidek, lotin harflarida)</label>
                <input
                  autoComplete="off"
                  value={holder}
                  onChange={(e) => setHolder(e.target.value.toUpperCase())}
                  placeholder="ALI VALIYEV"
                  className="input-field uppercase text-sm"
                />
                {touched && v.errors.holder && <p className="text-[11px] text-red-400 mt-1.5">{v.errors.holder}</p>}
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 mb-5">
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Karta saqlanmaydi — har safar kiritasiz, shuning uchun istalgan kartaga (masalan, yaqiningiznikiga) yechishingiz mumkin.
                  Pul yechishda qo'shimcha komissiya yo'q: komissiya sotuvda allaqachon hisoblangan.
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={onClose} className="btn-outline flex-1 !py-2.5 text-sm">Bekor qilish</button>
                <button onClick={goNext} className="btn-lime flex-1 !py-2.5 text-sm">Davom etish</button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-dark-card rounded-xl p-4 space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Summa</span>
                  <span className="text-base font-bold text-lime">{formatPrice(v.amountNum)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Karta</span>
                  <span className="text-xs font-mono text-white/90">{formatCard(v.cardDigits)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Egasi</span>
                  <span className="text-xs text-white/90">{normalizeHolder(holder)}</span>
                </div>
              </div>

              <div className="bg-yellow-500/[0.06] border border-yellow-500/20 rounded-lg p-3 mb-5 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-yellow-500/90 leading-relaxed">
                  Karta raqami va ism to'g'riligiga ishonch hosil qiling. Yuborilgach summa balansingizdan darhol ushlab qolinadi.
                  Ma'lumot noto'g'ri bo'lsa so'rov rad etiladi va summa balansingizga qaytariladi.
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} disabled={sending} className="btn-outline flex-1 !py-2.5 text-sm flex items-center justify-center gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" />Orqaga
                </button>
                <button onClick={submit} disabled={sending} className="btn-lime flex-1 !py-2.5 text-sm disabled:opacity-40">
                  {sending ? "Yuborilmoqda..." : "Tasdiqlash"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
