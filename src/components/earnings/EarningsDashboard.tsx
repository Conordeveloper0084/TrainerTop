"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Wallet, Loader2, ShoppingBag, TrendingUp, CheckCircle, Clock, X, ChevronRight, DollarSign, BookOpen, RefreshCw, Info,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { formatCard } from "@/lib/card";
import { MonthlyChart, type MonthPoint } from "./MonthlyChart";
import { PayoutModal } from "./PayoutModal";
import { PayoutDetailsModal } from "./PayoutDetailsModal";

interface Earnings {
  rate: number;
  custom_rate: boolean;
  balance: number;
  min_payout: number;
  lifetime: { gross: number; commission: number; net: number; sales: number };
  adjustments: number;
  payouts: { pending: number; paid: number; paid_count: number; rejected_count: number };
  reconciled: boolean;
  lessons: {
    lesson_id: string | null; title: string; status: string;
    sales: number; gross: number; commission: number; net: number; last_sale_at: string | null;
  }[];
  monthly: MonthPoint[];
  recent_sales: { created_at: string; lesson_title: string | null; gross: number; commission: number; net: number; rate: number }[];
}

const dShort = (s: string) => new Date(s).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" });

// Trener daromadi: yechishga tayyor balans → umumiy hisob → darsliklar → oylar → sotuvlar → yechishlar tarixi
export function EarningsDashboard() {
  const [data, setData] = useState<Earnings | null>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [eRes, pRes] = await Promise.all([fetch("/api/trainer/earnings", { cache: "no-store" }), fetch("/api/payouts", { cache: "no-store" })]);
      if (!eRes.ok) throw new Error("earnings");
      setData(await eRes.json());
      setPayouts(pRes.ok ? await pRes.json() : []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 text-lime animate-spin" /></div>;
  if (failed || !data) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-white/50 mb-4">Ma'lumotni yuklab bo'lmadi</p>
        <button onClick={load} className="btn-outline !py-2 !px-4 text-xs inline-flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5" />Qayta urinish</button>
      </div>
    );
  }

  const { rate, custom_rate, balance, min_payout, lifetime, adjustments, payouts: pay, lessons, monthly, recent_sales } = data;
  const hasPending = pay.pending > 0 || payouts.some((p) => p.status === "pending");
  const canWithdraw = !hasPending && balance >= min_payout;
  const thisMonth = monthly[monthly.length - 1];
  const example = 100000 - Math.round((100000 * rate) / 100);

  return (
    <div className="space-y-5">
      {/* 1. YECHISHGA TAYYOR BALANS */}
      <div className="card p-6 bg-gradient-to-br from-lime/[0.08] to-lime/[0.02] border-lime/20">
        <div className="flex items-start justify-between mb-1">
          <p className="text-xs text-lime/70">Yechishga tayyor balans</p>
          <Wallet className="h-4 w-4 text-lime/60" />
        </div>
        <p className="text-3xl font-bold text-lime">{formatPrice(balance)}</p>
        <p className="text-[11px] text-white/40 mt-2">Komissiya allaqachon ayirilgan — bu summa to'liq sizniki</p>

        {pay.pending > 0 && (
          <div className="mt-4 flex items-center gap-2 bg-yellow-500/[0.08] border border-yellow-500/20 rounded-lg px-3 py-2">
            <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
            <p className="text-[11px] text-yellow-500/90">{formatPrice(pay.pending)} yechish so'rovi ko'rib chiqilmoqda (balansdan ushlab qolingan)</p>
          </div>
        )}

        <button
          onClick={() => setShowModal(true)}
          disabled={!canWithdraw}
          className="btn-lime w-full text-sm !py-2.5 mt-4 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {hasPending ? "So'rov kutilmoqda" : balance < min_payout ? `Yechish uchun kamida ${formatPrice(min_payout)} kerak` : "Pul yechish"}
        </button>
      </div>

      {/* 2. KOMISSIYA */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-lime/10 flex items-center justify-center shrink-0 mt-0.5">
          <DollarSign className="h-3.5 w-3.5 text-lime" />
        </div>
        <p className="text-[11px] text-white/50 leading-relaxed">
          {rate === 0 ? (
            <>Sizda platforma komissiyasi <span className="text-lime font-semibold">0%</span> — har bir sotuvdan tushgan pul <span className="text-lime font-semibold">to'liq sizga</span> o'tadi.</>
          ) : (
            <>
              Har bir sotuvdan platforma <span className="text-lime font-semibold">{rate}% komissiya</span> oladi{custom_rate ? " (sizga belgilangan foiz)" : ""}.
              Misol: 100 000 so'mlik darslik sotilsa — sizga <span className="text-lime font-semibold">{formatPrice(example)}</span> tushadi.
            </>
          )}{" "}
          Foiz o'zgarsa, faqat keyingi sotuvlarga ta'sir qiladi.
        </p>
      </div>

      {/* 3. UMUMIY HISOB: sotuv → komissiya → sof */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Umumiy hisob</h3>
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={ShoppingBag} label="Jami sotuv" value={formatPrice(lifetime.gross)} sub={`${lifetime.sales} ta sotuv`} />
          <Stat icon={DollarSign} label="Komissiya" value={`− ${formatPrice(lifetime.commission)}`} sub={lifetime.gross > 0 ? `${Math.round((lifetime.commission / lifetime.gross) * 1000) / 10}%` : `${rate}%`} muted />
          <Stat icon={TrendingUp} label="Sof daromad" value={formatPrice(lifetime.net)} sub="shu kungacha" accent />
        </div>

        {/* Sof daromad qayerga ketgani — tenglik */}
        <div className="card p-4 mt-3">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Sof daromad qayerda</p>
          <div className="space-y-2 text-xs">
            <Line label="Hisobda (yechishga tayyor)" value={formatPrice(balance)} strong />
            <Line label="Ko'rib chiqilmoqda" value={formatPrice(pay.pending)} />
            <Line label={`Yechib olingan${pay.paid_count ? ` (${pay.paid_count} marta)` : ""}`} value={formatPrice(pay.paid)} />
            {adjustments !== 0 && <Line label="Tuzatishlar" value={`${adjustments > 0 ? "+" : "−"} ${formatPrice(Math.abs(adjustments))}`} />}
            <div className="border-t border-white/[0.06] pt-2 flex items-center justify-between font-semibold">
              <span className="text-white/60">Jami sof daromad</span>
              <span className="text-lime">{formatPrice(lifetime.net + adjustments)}</span>
            </div>
          </div>
          {data.reconciled ? (
            <p className="text-[10px] text-lime/60 mt-3 flex items-center gap-1.5"><CheckCircle className="h-3 w-3" />Hisob-kitob tekshirildi — hamma summalar mos</p>
          ) : (
            <p className="text-[10px] text-yellow-500 mt-3 flex items-center gap-1.5"><Info className="h-3 w-3" />Hisobda nomuvofiqlik topildi. Iltimos, support bilan bog'laning</p>
          )}
        </div>
      </div>

      {/* 4. DARSLIKLAR BO'YICHA */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Darsliklar bo'yicha</h3>
        {lessons.length === 0 ? (
          <div className="card p-8 text-center">
            <BookOpen className="h-8 w-8 text-white/10 mx-auto mb-2" />
            <p className="text-xs text-white/40">Hali darslik yo'q</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lessons.map((l, i) => (
              <div key={l.lesson_id || `${l.title}-${i}`} className="card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-sm font-medium truncate">{l.title}</p>
                  {l.status === "draft" && <span className="text-[9px] bg-white/[0.06] text-white/40 px-1.5 py-0.5 rounded-full shrink-0">Qoralama</span>}
                  {l.status === "deleted" && <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full shrink-0">O'chirilgan</span>}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Mini label="Sotilgan" value={`${l.sales} ta`} />
                  <Mini label="Jami" value={formatPrice(l.gross)} />
                  <Mini label="Komissiya" value={formatPrice(l.commission)} muted />
                  <Mini label="Sof" value={formatPrice(l.net)} accent />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. OYLIK GRAFIK */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Oylik sof daromad</h3>
          {thisMonth && <span className="text-[10px] text-white/40">Shu oy: <span className="text-lime font-semibold">{formatPrice(thisMonth.net)}</span> · {thisMonth.sales} ta</span>}
        </div>
        <MonthlyChart data={monthly} />
      </div>

      {/* 6. OXIRGI SOTUVLAR */}
      {recent_sales.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Oxirgi sotuvlar</h3>
          <div className="card divide-y divide-white/[0.04]">
            {recent_sales.map((s, i) => (
              <div key={i} className="p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-lime/10 flex items-center justify-center shrink-0"><ShoppingBag className="h-4 w-4 text-lime" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{s.lesson_title || "Darslik"}</p>
                  <p className="text-[10px] text-white/30">{dShort(s.created_at)} · {formatPrice(s.gross)}{s.commission > 0 ? ` − ${formatPrice(s.commission)} (${s.rate}%)` : ""}</p>
                </div>
                <p className="text-sm font-bold text-lime shrink-0">+ {formatPrice(s.net)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. PUL YECHISH TARIXI */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Pul yechish tarixi</h3>
          {payouts.length > 0 && <span className="text-[10px] text-white/30">{payouts.length} ta operatsiya</span>}
        </div>
        {payouts.length === 0 ? (
          <div className="card p-10 text-center">
            <TrendingUp className="h-8 w-8 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40">Hali pul yechilmagan</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payouts.map((p) => (
              <button key={p.id} onClick={() => setSelectedPayout(p)} className="card w-full p-4 text-left hover:border-lime/20 transition-all group">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    p.status === "completed" ? "bg-lime/10" : p.status === "rejected" ? "bg-red-500/10" : "bg-yellow-500/10")}>
                    {p.status === "completed" ? <CheckCircle className="h-5 w-5 text-lime" /> : p.status === "rejected" ? <X className="h-5 w-5 text-red-400" /> : <Clock className="h-5 w-5 text-yellow-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold">{formatPrice(p.amount)}</p>
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-semibold",
                        p.status === "completed" ? "bg-lime-muted text-lime" : p.status === "rejected" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-500")}>
                        {p.status === "completed" ? "O'tkazildi" : p.status === "rejected" ? "Rad etildi" : "Kutilmoqda"}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40 truncate">{formatCard(p.card_number || "")} · {dShort(p.requested_at)}</p>
                    {p.status === "rejected" && p.admin_note && <p className="text-[10px] text-red-400/80 truncate mt-0.5">Sabab: {p.admin_note}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-lime transition-colors shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <PayoutModal balance={balance} minPayout={min_payout} onClose={() => setShowModal(false)} onDone={() => { setShowModal(false); load(); }} />
      )}
      {selectedPayout && <PayoutDetailsModal payout={selectedPayout} onClose={() => setSelectedPayout(null)} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, accent, muted }: { icon: any; label: string; value: string; sub?: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className={cn("card p-3.5", accent && "border-lime/20")}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn("h-3.5 w-3.5", accent ? "text-lime" : "text-white/40")} />
        <p className="text-[9px] text-white/40 uppercase tracking-wider">{label}</p>
      </div>
      <p className={cn("text-sm font-bold leading-tight", accent ? "text-lime" : muted ? "text-white/60" : "text-white")}>{value}</p>
      {sub && <p className="text-[10px] text-white/30 mt-1">{sub}</p>}
    </div>
  );
}

function Mini({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div>
      <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-[11px] font-semibold leading-tight break-words", accent ? "text-lime" : muted ? "text-white/50" : "text-white/80")}>{value}</p>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50">{label}</span>
      <span className={cn(strong ? "text-white font-semibold" : "text-white/70")}>{value}</span>
    </div>
  );
}
