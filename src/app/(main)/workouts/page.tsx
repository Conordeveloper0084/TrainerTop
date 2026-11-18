"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Flame, Loader2, Play, Plus, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { WorkoutGate } from "@/components/workouts/WorkoutGate";
import { ErrorBox, SessionRow, Spinner, useStartWorkout } from "@/components/workouts/common";
import { PROGRAM_TEMPLATES, WEEKDAYS_SHORT, formatDateUz, localToday, nextDay, relativeDay } from "@/lib/workout";
import { getExercises, loadDraft, wapi, withToday, type Draft } from "@/lib/workout-client";

// KUNDALIK — bosh sahifa: davom etayotgan mashg'ulot, bu hafta (mashg'ulotlar, yutuqlar, rekordlar), programmalar
// (asosiysida — "Navbatdagi kun" bir bosishda), oxirgi mashg'ulotlar.
export default function WorkoutsPage() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const start = useStartWorkout();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const today = localToday();

  const load = useCallback(async () => {
    setError("");
    try { setData(await wapi(withToday(""))); } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { if (user) { load(); setDraft(loadDraft(user.id)); } }, [user, load]);

  const createFromTemplate = async (t: (typeof PROGRAM_TEMPLATES)[number]) => {
    setCreating(t.name);
    try {
      const all = await getExercises();
      const days = t.days.map((d) => ({ name: d.name, exercises: d.slugs.map((s) => all.find((e) => e.slug === s)?.id).filter(Boolean).map((id) => ({ exercise_id: id })) }));
      await wapi("/programs", { method: "POST", body: { name: t.name, days } });
      toast.success(`"${t.name}" yaratildi — mashqlarni o'zingizga moslashingiz mumkin`);
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setCreating(null); }
  };

  if (!ready) return <Spinner />;
  if (!user) return <WorkoutGate />;
  if (error && !data) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Spinner />;

  const programs: any[] = data.programs || [];
  const [primary, ...others] = programs;
  return (
    <div className="container-main py-6 max-w-2xl" data-testid="workouts-home">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-page-title text-white">Kundalik</h1>
          <p className="text-xs text-white/40 mt-0.5">Mashg'ulotlaringiz va progressingiz</p>
        </div>
        <div className="flex gap-2">
          <Link href="/workouts/history" className="btn-ghost !py-2 !px-3 text-xs">Tarix</Link>
          <Link href="/workouts/exercises" className="btn-ghost !py-2 !px-3 text-xs">Progress</Link>
        </div>
      </div>

      {draft && (
        <Link href="/workouts/log" className="card border-lime/40 bg-lime-subtle p-4 mb-4 flex items-center gap-3" data-testid="draft-banner">
          <div className="h-10 w-10 rounded-full bg-lime flex items-center justify-center shrink-0"><Play className="h-4 w-4 text-black" fill="currentColor" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{draft.editing ? "Tahrirlanmoqda" : "Tugallanmagan mashg'ulot"}: {draft.title}</p>
            <p className="text-xs text-white/40">{formatDateUz(draft.performed_on, today)} · davom ettirish</p>
          </div>
          <ChevronRight className="h-4 w-4 text-white/30" />
        </Link>
      )}

      <WeekCard week={data.week} today={today} />

      <div className="flex items-center justify-between mt-7 mb-3">
        <h2 className="text-h3 text-white">Programmalarim</h2>
        {programs.length > 0 && <Link href="/workouts/programs/new" className="text-sm text-lime flex items-center gap-1" data-testid="new-program"><Plus className="h-4 w-4" />Yangi</Link>}
      </div>

      {programs.length === 0 ? (
        <div className="card p-5" data-testid="programs-empty">
          <p className="text-sm text-white mb-1 font-semibold">Birinchi programmangizni yarating</p>
          <p className="text-xs text-white/40 mb-4">Programma — mashg'ulot kunlaringiz to'plami (masalan, PPL: Push, Pull, Leg kunlari). Tayyor shablondan boshlang yoki o'zingiz tuzing:</p>
          <div className="space-y-2 mb-4">
            {PROGRAM_TEMPLATES.map((t) => (
              <button key={t.name} type="button" disabled={!!creating} onClick={() => createFromTemplate(t)} data-testid="template"
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.08] disabled:opacity-40 flex items-center gap-3 text-left">
                {creating === t.name ? <Loader2 className="h-4 w-4 animate-spin text-lime shrink-0" /> : <Plus className="h-4 w-4 text-lime shrink-0" />}
                <span className="min-w-0"><span className="block text-sm text-white">{t.name}</span><span className="block text-[11px] text-white/40">{t.hint}</span></span>
              </button>
            ))}
          </div>
          <Link href="/workouts/programs/new" className="btn-lime !py-2.5 !px-4 text-sm inline-block">O'zim yarataman</Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          <PrimaryProgram p={primary} today={today} onStart={start} />
          {others.map((p) => (
            <Link key={p.id} href={`/workouts/programs/${p.id}`} className="card p-4 flex items-center gap-3 hover:bg-white/[0.02]" data-testid="program-card">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-white truncate">{p.name}</p>
                <p className="text-xs text-white/40 truncate mt-0.5">{p.days.length} kun · {p.days.map((d: any) => d.name).join(", ") || "kun qo'shilmagan"}</p>
                <p className="text-[11px] text-white/30 mt-0.5">Oxirgi marta: {relativeDay(p.last_performed_on, today)}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
            </Link>
          ))}
        </div>
      )}
      <button type="button" onClick={() => start("/workouts/log?free=1", "Erkin mashg'ulot")} className="btn-ghost w-full !py-2.5 text-sm mt-2.5" data-testid="start-free">
        Programmasiz boshlash (erkin mashg'ulot)
      </button>

      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="text-h3 text-white">Oxirgi mashg'ulotlar</h2>
        {data.recent.length > 0 && <Link href="/workouts/history" className="text-sm text-lime">Hammasi</Link>}
      </div>
      {data.recent.length === 0 ? (
        <p className="text-sm text-white/30 card p-5 text-center">Hali mashg'ulot yozilmagan. Kunni tanlab "Boshlash"ni bosing.</p>
      ) : (
        <div className="card divide-y divide-white/[0.06]" data-testid="recent-list">
          {data.recent.map((s: any) => <SessionRow key={s.id} s={s} today={today} />)}
        </div>
      )}
    </div>
  );
}

// Asosiy programma: "Navbatdagi" kun katta tugma bilan, qolgan kunlar ixcham ro'yxatda
function PrimaryProgram({ p, today, onStart }: { p: any; today: string; onStart: (href: string, label: string) => void }) {
  const next = nextDay<any>(p.days, p.last_split_id);
  return (
    <div className="card p-4" data-testid="primary-program">
      <Link href={`/workouts/programs/${p.id}`} className="flex items-center gap-2 group">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-white truncate group-hover:text-lime">{p.name}</p>
          <p className="text-xs text-white/40">{p.days.length} kun · so'nggi 30 kunda {p.sessions_30d} mashg'ulot</p>
        </div>
        <span className="text-xs text-lime flex items-center shrink-0">Ochish<ChevronRight className="h-3.5 w-3.5" /></span>
      </Link>
      {next ? (
        <>
          <div className="mt-3 rounded-xl bg-white/[0.04] p-3" data-testid="next-day">
            <p className="text-[11px] text-white/40">Navbatdagi</p>
            <p className="text-base font-semibold text-white">{next.name}</p>
            <p className="text-[11px] text-white/30 truncate">{next.exercises.length > 0 ? next.exercises.map((e: any) => e.name).join(", ") : "Mashq qo'shilmagan"}</p>
            <button type="button" onClick={() => onStart(`/workouts/log?split=${next.id}`, next.name)} disabled={next.exercises.length === 0} data-testid="start-next"
              className="btn-lime w-full !py-2.5 text-sm mt-2.5 flex items-center justify-center gap-2 disabled:opacity-30">
              <Play className="h-3.5 w-3.5" fill="currentColor" />Boshlash
            </button>
          </div>
          {p.days.length > 1 && (
            <div className="mt-2 divide-y divide-white/[0.06]">
              {p.days.filter((d: any) => d.id !== next.id).map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 py-2.5" data-testid="day-row">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{d.name}</p>
                    <p className="text-[11px] text-white/30">{d.exercises.length} mashq · {relativeDay(d.last_performed_on, today)}</p>
                  </div>
                  <button type="button" onClick={() => onStart(`/workouts/log?split=${d.id}`, d.name)} disabled={d.exercises.length === 0} data-testid="start-day"
                    className="btn-ghost !py-1.5 !px-3 text-xs disabled:opacity-30">Boshlash</button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <Link href={`/workouts/splits/new?program=${p.id}`} className="mt-3 h-12 rounded-xl border-2 border-dashed border-lime/50 text-lime text-sm flex items-center justify-center gap-1.5"><Plus className="h-4 w-4" />Kun qo'shish</Link>
      )}
    </div>
  );
}

function WeekCard({ week, today }: { week: any; today: string }) {
  return (
    <div className="card p-4" data-testid="week-card">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white">Bu hafta</p>
        {week.streak_weeks > 0 && (
          <span className="badge-lime !px-2 !py-0.5" data-testid="streak"><Flame className="h-3 w-3" />{week.streak_weeks} hafta ketma-ket</span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1.5 mb-4" data-testid="week-days">
        {(week.days || []).map((d: any, i: number) => {
          const done = d.sessions > 0; const isToday = d.date === today;
          return (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <span className={cn("text-[10px]", isToday ? "text-lime font-semibold" : "text-white/30")}>{WEEKDAYS_SHORT[i]}</span>
              <span data-done={done} className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs",
                done ? "bg-lime text-black font-bold" : isToday ? "border border-lime/60 text-white/60" : "bg-white/[0.04] text-white/30")}>
                {Number(d.date.slice(8))}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Mashg'ulotlar" value={week.sessions} sub={`o'tgan hafta ${week.prev_sessions}`} testid="week-sessions" />
        <Tile label="Yutuqlar" value={week.achievements ?? 0} sub="o'sish" testid="week-achievements" lime={(week.achievements ?? 0) > 0} />
        <Tile label="Rekordlar" value={week.records ?? 0} sub="eng yaxshi natija" testid="week-records" icon={(week.records ?? 0) > 0} />
      </div>
    </div>
  );
}

function Tile({ label, value, sub, testid, lime, icon }: { label: string; value: number; sub: string; testid: string; lime?: boolean; icon?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-3 min-w-0">
      <p className="text-[11px] text-white/40 truncate">{label}</p>
      <p className={cn("text-lg font-bold flex items-center gap-1", lime || icon ? "text-lime" : "text-white")} data-testid={testid}>
        {icon && <Trophy className="h-4 w-4" />}{value}
      </p>
      <p className="text-[10px] text-white/30 truncate">{sub}</p>
    </div>
  );
}
