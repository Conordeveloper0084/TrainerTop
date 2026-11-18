"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Send, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateUz, formatKg, localToday, relativeDay } from "@/lib/workout";
import { wapi } from "@/lib/workout-client";
import { LineChart } from "@/components/workouts/LineChart";
import { askConfirm } from "@/components/workouts/confirm";

export type Period = "4w" | "3m" | "all";
const PERIODS: { id: Period; label: string }[] = [{ id: "4w", label: "4 hafta" }, { id: "3m", label: "3 oy" }, { id: "all", label: "Hammasi" }];

// PDF: brauzerning "Chop etish → PDF sifatida saqlash" oynasi. Chop etishda faqat hisobot ko'rinadi va yorug' rangda chiqadi
// (qog'ozga/PDFga qora fon kerak emas); keyin foydalanuvchining mavzusi qaytariladi.
export function printReport() {
  const el = document.documentElement;
  const prev = el.dataset.theme;
  el.dataset.theme = "light";
  const restore = () => { if (prev) el.dataset.theme = prev; else delete el.dataset.theme; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  setTimeout(() => { window.print(); setTimeout(restore, 1000); }, 50);
}

// Hisobot ko'rinishi — egasi (programma sahifasidan) va trener (ulashilgan havola) uchun bir xil
export function ReportView({ report, period, onPeriod, owner, header }: {
  report: any; period: Period; onPeriod: (p: Period) => void; owner?: { programId: string }; header?: React.ReactNode;
}) {
  const today = localToday();
  const s = report.summary;
  return (
    <div id="workout-report" data-testid="report">
      {header}
      <div className="flex gap-1.5 mb-4 no-print" data-testid="period-tabs">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" onClick={() => onPeriod(p.id)} aria-pressed={period === p.id}
            className={cn("px-3 py-1.5 rounded-full text-xs", period === p.id ? "bg-lime text-black font-semibold" : "bg-white/[0.06] text-white/60")}>{p.label}</button>
        ))}
      </div>
      <p className="text-xs text-white/40 mb-3">
        {report.period.from ? `${formatDateUz(report.period.from, today)} — ${formatDateUz(report.period.to, today)}` : "Hali mashg'ulot yo'q"}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5" data-testid="report-summary">
        <Tile label="Mashg'ulotlar" value={s.sessions} />
        <Tile label="Faol haftalar" value={s.active_weeks} />
        <Tile label="Yutuqlar" value={s.achievements} lime />
        <Tile label="Rekordlar" value={s.records} trophy />
      </div>

      {owner && <OwnerActions programId={owner.programId} />}

      {report.days.length > 0 && (
        <>
          <h2 className="text-h3 text-white mb-2">Kunlar</h2>
          <div className="card divide-y divide-white/[0.06] mb-5" data-testid="report-days">
            {report.days.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-white">{d.name}</span>
                <span className="text-white/40 text-xs">{d.sessions} marta · {relativeDay(d.last_performed_on, today)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-h3 text-white mb-2">Mashqlar bo'yicha o'sish</h2>
      {report.exercises.length === 0 ? (
        <p className="text-sm text-white/30 card p-5 text-center mb-5">Bu davrda mashg'ulot yozilmagan</p>
      ) : (
        <div className="space-y-2.5 mb-5" data-testid="report-exercises">
          {report.exercises.map((e: any) => <ExerciseBlock key={e.exercise.id} e={e} today={today} />)}
        </div>
      )}

      {report.recent.length > 0 && (
        <>
          <h2 className="text-h3 text-white mb-2">Oxirgi mashg'ulotlar</h2>
          <div className="card divide-y divide-white/[0.06] mb-5">
            {report.recent.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-white">{r.title} <span className="text-white/30 text-xs">· {formatDateUz(r.performed_on, today)}</span></span>
                <span className="text-xs text-white/40">{r.exercises_count} mashq · {r.sets_count} padxod{r.achievements > 0 && <span className="text-lime"> · {r.achievements} yutuq</span>}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="text-[10px] text-white/30 text-center">TrainerTop.uz · {formatDateUz(today)} holatiga</p>
    </div>
  );
}

function ExerciseBlock({ e, today }: { e: any; today: string }) {
  const pure = e.pure_bodyweight;
  const delta = pure ? e.delta_reps : e.delta_kg;
  const unit = pure ? "takror" : "kg";
  const fmt = (x: any) => (pure ? `${x.max_reps}` : `${formatKg(x.max_weight)} kg`);
  return (
    <div className="card p-4" data-testid="report-exercise">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15px] font-semibold text-white min-w-0 truncate">{e.exercise.name}</p>
        {e.achievements > 0 && <span className="text-[11px] text-lime shrink-0 flex items-center gap-1"><Trophy className="h-3 w-3" />{e.achievements} yutuq</span>}
      </div>
      {e.sessions_count > 1 ? (
        <p className="text-sm mt-1">
          <span className="text-white/50">{fmt(e.first)}</span><span className="text-white/30"> → </span><span className="text-white font-semibold">{fmt(e.last)}{pure ? " takror" : ""}</span>
          <span className={cn("ml-2 text-xs font-semibold", delta > 0 ? "text-lime" : delta < 0 ? "text-red-400" : "text-white/40")} data-testid="report-delta">
            {delta > 0 ? "+" : ""}{pure ? delta : formatKg(delta)} {unit}
          </span>
        </p>
      ) : <p className="text-sm text-white mt-1">{fmt(e.last)}{pure ? " takror" : ""}</p>}
      <p className="text-[11px] text-white/30 mt-0.5">
        {e.sessions_count} marta{!pure && e.best.max_weight > 0 ? ` · eng og'ir: ${formatKg(e.best.max_weight)} kg × ${e.best.reps_at_top}` : ""}
      </p>
      {e.chart.length > 2 && new Set(e.chart.map((c: any) => (pure ? c.max_reps : c.max_weight))).size > 1 && <div className="mt-2"><LineChart points={e.chart.map((c: any) => ({ date: c.performed_on, value: pure ? c.max_reps : c.max_weight }))} unit={unit} today={today} /></div>}
    </div>
  );
}

function Tile({ label, value, lime, trophy }: { label: string; value: number; lime?: boolean; trophy?: boolean }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] text-white/40">{label}</p>
      <p className={cn("text-xl font-bold flex items-center gap-1", (lime || trophy) && value > 0 ? "text-lime" : "text-white")}>{trophy && value > 0 && <Trophy className="h-4 w-4" />}{value}</p>
    </div>
  );
}

// Egasi uchun: PDF, trenerga yuborish, kimlar ko'rayotgani (to'xtatish)
function OwnerActions({ programId }: { programId: string }) {
  const [dialog, setDialog] = useState(false);
  const [shares, setShares] = useState<any[]>([]);
  const loadShares = useCallback(() => { wapi<{ shares: any[] }>(`/programs/${programId}/shares`).then((d) => setShares(d.shares)).catch(() => {}); }, [programId]);
  useEffect(() => { loadShares(); }, [loadShares]);
  const revoke = async (sh: any) => {
    if (!(await askConfirm({ title: "Ulashish to'xtatilsinmi?", message: `${sh.viewer.full_name} bu hisobotni endi ko'ra olmaydi. Chatdagi havola ishlamay qoladi.`, confirmText: "To'xtatish" }))) return;
    try { await wapi(`/shares/${sh.id}`, { method: "DELETE" }); toast.success("Ulashish to'xtatildi"); loadShares(); }
    catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="no-print mb-6">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={printReport} className="btn-ghost !py-3 text-sm flex items-center justify-center gap-2" data-testid="print-report"><Download className="h-4 w-4" />PDF yuklash</button>
        <button type="button" onClick={() => setDialog(true)} className="btn-lime !py-3 text-sm flex items-center justify-center gap-2" data-testid="share-report"><Send className="h-4 w-4" />Trenerga yuborish</button>
      </div>
      {shares.length > 0 && (
        <div className="card p-3 mt-3" data-testid="share-list">
          <p className="text-[11px] text-white/40 mb-2">Hisobotni ko'ra oladi (har doim eng yangi natijalar):</p>
          {shares.map((sh) => (
            <div key={sh.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-white">{sh.viewer.full_name}</span>
              <button type="button" onClick={() => revoke(sh)} className="text-xs text-red-400" data-testid="revoke-share">To'xtatish</button>
            </div>
          ))}
        </div>
      )}
      {dialog && <ShareDialog programId={programId} onClose={() => setDialog(false)} onShared={loadShares} />}
    </div>
  );
}

function ShareDialog({ programId, onClose, onShared }: { programId: string; onClose: () => void; onShared: () => void }) {
  const [list, setList] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { wapi<{ trainers: any[] }>("/share-targets").then((d) => setList(d.trainers)).catch((e) => { toast.error(e.message); setList([]); }); }, []);
  const send = async (t: any) => {
    const ok = await askConfirm({ title: `${t.full_name}ga yuborilsinmi?`, message: "Chatga hisobot havolasi yuboriladi. Trener har ochganda eng yangi natijalaringizni ko'radi. Istalgan payt to'xtatishingiz mumkin.", confirmText: "Yuborish", danger: false });
    if (!ok) return;
    setBusy(t.id);
    try {
      await wapi(`/programs/${programId}/shares`, { method: "POST", body: { viewer_id: t.id } });
      toast.success(`Hisobot ${t.full_name}ga chat orqali yuborildi`);
      onShared(); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Trenerga yuborish" data-testid="share-dialog">
      <button type="button" aria-label="Yopish" className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-dark-surface border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-h3 text-white">Trenerga yuborish</h2>
          <button type="button" onClick={onClose} aria-label="Yopish" className="p-2 -mr-2 text-white/40"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-white/40 mb-3">Chatingizdagi trenerlar. Trener hisobotni jonli ko'radi — siz yangi mashg'ulot yozsangiz, unda ham yangilanadi.</p>
        <div className="overflow-y-auto">
          {list === null ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 text-lime animate-spin" /></div>
            : list.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-white/40 mb-3">Hali hech bir trener bilan chatingiz yo'q.</p>
                <Link href="/trainers" className="btn-soft !py-2 !px-4 text-sm">Trener topish</Link>
              </div>
            ) : list.map((t) => (
              <button key={t.id} type="button" onClick={() => send(t)} disabled={!!busy} data-testid="share-target"
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] text-left disabled:opacity-50">
                {t.avatar_url ? <img src={t.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="h-10 w-10 rounded-full bg-lime-muted text-lime flex items-center justify-center font-bold">{(t.full_name || "?")[0]}</span>}
                <span className="flex-1 text-sm text-white">{t.full_name}</span>
                {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin text-lime" /> : <Send className="h-4 w-4 text-lime" />}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
