"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Minus, Target, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { WorkoutGate } from "@/components/workouts/WorkoutGate";
import { ErrorBox, Spinner } from "@/components/workouts/common";
import { LineChart } from "@/components/workouts/LineChart";
import { equipmentLabel, formatDateUz, formatKg, formatSets, isAchievement, localToday, muscleLabel, outcomeBadge, type Outcome } from "@/lib/workout";
import { wapi } from "@/lib/workout-client";

type Metric = "max_weight" | "max_reps";

// Bitta mashq: boshlaganidan beri o'zgarish, oxirgi mashg'ulot natijasi, keyingi maqsad, rekordlar, grafik, tarix.
// Oddiy foydalanuvchi uchun tushunarli: kilogramm va takror (hajm/1RM ko'rsatilmaydi).
export default function ExerciseStatsPage({ params }: { params: { id: string } }) {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState<Metric | null>(null);
  const today = localToday();
  useEffect(() => { if (user) wapi(`/exercises/${params.id}/stats`).then(setD).catch((e) => setError(e.message)); }, [user, params.id]);

  const pure = !!d?.pure_bodyweight;
  const m: Metric = pure ? "max_reps" : metric ?? "max_weight";
  const points = useMemo(() => (d?.chart || []).map((c: any) => ({ date: c.performed_on, value: Number(c[m]) || 0 })), [d, m]);

  if (!ready) return <Spinner />;
  if (!user) return <WorkoutGate />;
  if (error) return <ErrorBox message={error} backHref="/workouts/exercises" backText="Orqaga" />;
  if (!d) return <Spinner />;
  const r = d.records, ss = d.since_start;
  return (
    <div className="container-main py-6 max-w-xl" data-testid="exercise-stats">
      <Link href="/workouts/exercises" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white mb-4"><ChevronLeft className="h-3.5 w-3.5" />Progress</Link>
      <h1 className="text-page-title text-white">{d.exercise.name}</h1>
      <p className="text-xs text-white/40 mt-1 mb-5">{[d.exercise.name_uz, d.exercise.muscle_group !== "other" && muscleLabel(d.exercise.muscle_group), d.exercise.equipment !== "other" && equipmentLabel(d.exercise.equipment)].filter(Boolean).join(" · ")}</p>

      {d.sessions_count === 0 ? (
        <p className="text-sm text-white/30 card p-6 text-center">Bu mashq hali bajarilmagan</p>
      ) : (
        <>
          {ss && (
            <div className="card p-4" data-testid="since-start">
              <p className="text-[11px] text-white/40">Boshlaganingizdan beri ({formatDateUz(ss.first_date, today)})</p>
              {pure ? (
                <Delta from={`${ss.first_max_reps}`} to={`${ss.last_max_reps} takror`} delta={ss.delta_reps} unit="takror" />
              ) : (
                <Delta from={`${formatKg(ss.first_max_weight)} kg`} to={`${formatKg(ss.last_max_weight)} kg`} delta={ss.delta_kg} unit="kg" />
              )}
              <p className="text-[11px] text-white/30 mt-1">{d.sessions_count} ta mashg'ulot</p>
            </div>
          )}
          {d.last_outcome && <OutcomeCard o={d.last_outcome} today={today} />}
          {d.next_target && (
            <div className="card p-3.5 mt-3 flex items-center gap-3" data-testid="next-target">
              <Target className="h-5 w-5 text-lime shrink-0" />
              <div><p className="text-[11px] text-white/40">Keyingi safar uchun maqsad</p><p className="text-sm text-white">{d.next_target.text}</p></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-3" data-testid="records">
            {!pure && (
              <div className="card p-3">
                <p className="text-[11px] text-white/40">Eng og'ir vazn</p>
                <p className="text-lg font-bold text-white">{r.max_weight ? `${formatKg(r.max_weight.value)} kg` : "—"}{r.max_weight && <span className="text-xs text-white/40 font-normal"> × {r.max_weight.reps}</span>}</p>
                {r.max_weight && <p className="text-[10px] text-white/30">{formatDateUz(r.max_weight.performed_on, today)}</p>}
              </div>
            )}
            <div className={cn("card p-3", pure && "col-span-2")}>
              <p className="text-[11px] text-white/40">Eng ko'p takror</p>
              <p className="text-lg font-bold text-white">{r.max_reps ? r.max_reps.value : "—"}{r.max_reps && !pure && r.max_reps.weight_kg > 0 && <span className="text-xs text-white/40 font-normal"> ({formatKg(r.max_reps.weight_kg)} kg da)</span>}</p>
              {r.max_reps && <p className="text-[10px] text-white/30">{formatDateUz(r.max_reps.performed_on, today)}</p>}
            </div>
          </div>

          {points.length > 1 && (
            <div className="card p-4 mt-3">
              {!pure && (
                <div className="flex gap-1.5 mb-3" data-testid="metric-tabs">
                  {([["max_weight", "Vazn"], ["max_reps", "Takror"]] as const).map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setMetric(id)} aria-pressed={m === id}
                      className={cn("px-3 py-1 rounded-full text-xs", m === id ? "bg-lime text-black font-semibold" : "bg-white/[0.06] text-white/60")}>{label}</button>
                  ))}
                </div>
              )}
              <LineChart points={points} unit={m === "max_weight" ? "kg" : "takror"} today={today} />
            </div>
          )}

          <h2 className="text-h3 text-white mt-7 mb-3">Tarix</h2>
          <div className="card divide-y divide-white/[0.06]" data-testid="stats-history">
            {d.history.map((h: any) => (
              <Link key={h.session_id} href={`/workouts/history/${h.session_id}`} className="block p-4 hover:bg-white/[0.02]">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm text-white font-medium">{formatDateUz(h.performed_on, today)}</p>
                  {h.outcome && isAchievement(h.outcome) && (
                    <span className={cn("text-[11px] font-semibold", h.outcome.type === "record" ? "text-amber-400" : "text-lime")} data-testid="history-badge">{outcomeBadge(h.outcome)}</span>
                  )}
                </div>
                <p className="text-xs text-white/60 mt-0.5">{formatSets(h.sets, d.exercise.is_bodyweight)}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Delta({ from, to, delta, unit }: { from: string; to: string; delta: number; unit: string }) {
  const up = delta > 0, down = delta < 0;
  return (
    <div className="flex items-baseline flex-wrap gap-x-2 mt-1">
      <span className="text-lg text-white/50">{from}</span><span className="text-white/30">→</span>
      <span className="text-2xl font-bold text-white">{to}</span>
      <span className={cn("text-sm font-semibold", up ? "text-lime" : down ? "text-red-400" : "text-white/40")} data-testid="since-delta">
        {up ? "+" : ""}{unit === "kg" ? formatKg(delta) : delta} {unit}
      </span>
    </div>
  );
}

function OutcomeCard({ o, today }: { o: Outcome & { current: string; previous: string }; today: string }) {
  const win = isAchievement(o);
  const Icon = o.type === "record" ? Trophy : win ? TrendingUp : o.type === "down" ? TrendingDown : Minus;
  const title = o.type === "record" ? "Yangi rekord!" : win ? "Kuchingiz oshdi" : o.type === "down" ? "Bu safar biroz pastroq" : "Natija o'zgarmadi";
  return (
    <div className={cn("card p-4 mt-3", win && "border-lime/40")} data-testid="comparison" data-verdict={o.type}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-5 w-5", o.type === "record" ? "text-amber-400" : win ? "text-lime" : o.type === "down" ? "text-red-400" : "text-white/40")} />
        <p className="text-sm font-semibold text-white">{title}</p>
        {o.type !== "same" && <span className="ml-auto text-xs text-white/50">{outcomeBadge(o)}</span>}
      </div>
      <p className="text-xs text-white/40 mt-1">Oxirgi mashg'ulot ({formatDateUz(o.current, today)}) oldingisiga ({formatDateUz(o.previous, today)}) nisbatan</p>
      {o.type === "down" && <p className="text-[11px] text-white/30 mt-2">Bu normal — charchoq, uyqu va ovqat ta'sir qiladi. Asosiysi — haftalar davomidagi umumiy yo'nalish.</p>}
    </div>
  );
}
