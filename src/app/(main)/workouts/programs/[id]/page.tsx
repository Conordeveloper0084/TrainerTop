"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, ChevronLeft, Pencil, Play, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store/auth-store";
import { WorkoutGate } from "@/components/workouts/WorkoutGate";
import { ErrorBox, Spinner, useStartWorkout } from "@/components/workouts/common";
import { askConfirm } from "@/components/workouts/confirm";
import { WORKOUT_LIMITS, formatDateUz, localToday, nextDay, relativeDay } from "@/lib/workout";
import { wapi } from "@/lib/workout-client";

// Programma: qisqa statistika, navbatdagi kun, kunlar ro'yxati (boshlash / tahrirlash), hisobot, sozlamalar
export default function ProgramPage({ params }: { params: { id: string } }) {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const router = useRouter();
  const start = useStartWorkout();
  const [p, setP] = useState<any>(null);
  const [error, setError] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);
  const [renaming, setRenaming] = useState<string | null>(null);
  const today = localToday();

  const load = useCallback(async () => {
    try {
      const [d, o] = await Promise.all([wapi<{ program: any }>(`/programs/${params.id}`), wapi<{ programs: any[] }>(`?today=${localToday()}`).catch(() => null)]);
      setP(d.program); if (o) setIsPrimary(o.programs[0]?.id === params.id);
    } catch (e: any) { setError(e.message); }
  }, [params.id]);
  useEffect(() => { if (user) load(); }, [user, load]);

  const rename = async () => {
    if (!renaming?.trim()) { toast.error("Nomni kiriting"); return; }
    try { const d = await wapi<{ program: any }>(`/programs/${p.id}`, { method: "PATCH", body: { name: renaming } }); setP(d.program); setRenaming(null); toast.success("Saqlandi"); }
    catch (e: any) { toast.error(e.message); }
  };
  const makePrimary = async () => {
    try { await wapi(`/programs/${p.id}`, { method: "PATCH", body: { primary: true } }); setIsPrimary(true); toast.success("Asosiy programma — endi bosh sahifada birinchi"); }
    catch (e: any) { toast.error(e.message); }
  };
  const remove = async () => {
    const ok = await askConfirm({ title: `"${p.name}" o'chirilsinmi?`, message: `${p.days.length} ta kun va ulardagi mashqlar ro'yxati o'chadi.\nYozilgan mashg'ulotlaringiz tarixda va statistikada qoladi.` });
    if (!ok) return;
    try { await wapi(`/programs/${p.id}`, { method: "DELETE" }); toast.success("Programma o'chirildi"); router.push("/workouts"); }
    catch (e: any) { toast.error(e.message); }
  };

  if (!ready) return <Spinner />;
  if (!user) return <WorkoutGate />;
  if (error) return <ErrorBox message={error} />;
  if (!p) return <Spinner />;
  const next = nextDay<any>(p.days, p.last_split_id);
  return (
    <div className="container-main py-6 max-w-xl" data-testid="program-page">
      <Link href="/workouts" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white mb-4"><ChevronLeft className="h-3.5 w-3.5" />Kundalik</Link>
      {renaming !== null ? (
        <form onSubmit={(e) => { e.preventDefault(); rename(); }} className="flex gap-2 mb-2">
          <input value={renaming} onChange={(e) => setRenaming(e.target.value)} maxLength={WORKOUT_LIMITS.programName} className="input-field !py-2 flex-1" autoFocus data-testid="rename-input" />
          <button type="submit" className="btn-lime !py-2 !px-4 text-sm">Saqlash</button>
          <button type="button" onClick={() => setRenaming(null)} className="btn-ghost !py-2 !px-3 text-sm">Bekor</button>
        </form>
      ) : (
        <div className="flex items-start gap-2 mb-1">
          <h1 className="text-page-title text-white flex-1 min-w-0 break-words" data-testid="program-title">{p.name}</h1>
          <button type="button" onClick={() => setRenaming(p.name)} aria-label="Nomini o'zgartirish" className="p-2 text-white/30 hover:text-white"><Pencil className="h-4 w-4" /></button>
        </div>
      )}
      {isPrimary ? <p className="text-xs text-lime mb-4 flex items-center gap-1"><Star className="h-3 w-3" fill="currentColor" />Asosiy programma</p>
        : <button type="button" onClick={makePrimary} className="text-xs text-white/40 hover:text-lime mb-4 flex items-center gap-1" data-testid="make-primary"><Star className="h-3 w-3" />Asosiy qilish</button>}

      <div className="grid grid-cols-3 gap-2 mb-4" data-testid="program-stats">
        <Stat label="Jami" value={String(p.sessions_count)} sub="mashg'ulot" />
        <Stat label="So'nggi 30 kun" value={String(p.sessions_30d)} sub="mashg'ulot" />
        <Stat label="Oxirgi marta" value={p.last_performed_on ? formatDateUz(p.last_performed_on, today) : "—"} sub={p.last_performed_on ? relativeDay(p.last_performed_on, today) : "hali yo'q"} />
      </div>

      {next && next.exercises.length > 0 && (
        <div className="card border-lime/30 p-4 mb-4" data-testid="next-day">
          <p className="text-[11px] text-white/40">Navbatdagi kun</p>
          <p className="text-lg font-semibold text-white">{next.name}</p>
          <button type="button" onClick={() => start(`/workouts/log?split=${next.id}`, next.name)} className="btn-lime w-full !py-2.5 text-sm mt-2.5 flex items-center justify-center gap-2" data-testid="start-next">
            <Play className="h-3.5 w-3.5" fill="currentColor" />Boshlash
          </button>
        </div>
      )}

      <h2 className="text-h3 text-white mb-3">Kunlar</h2>
      <div className="space-y-2.5" data-testid="day-list">
        {p.days.map((d: any) => (
          <div key={d.id} className="card p-4" data-testid="day-card">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-white truncate">{d.name}</p>
                <p className="text-xs text-white/40 truncate mt-0.5">{d.exercises.length > 0 ? `${d.exercises.length} mashq · ${d.exercises.map((e: any) => e.name).join(", ")}` : "Mashq qo'shilmagan"}</p>
                <p className="text-[11px] text-white/30 mt-1">Oxirgi marta: {relativeDay(d.last_performed_on, today)}</p>
              </div>
              <Link href={`/workouts/splits/${d.id}`} aria-label={`${d.name} ni tahrirlash`} className="p-2 -mr-1 text-white/30 hover:text-white"><Pencil className="h-4 w-4" /></Link>
            </div>
            {d.exercises.length > 0 ? (
              <button type="button" onClick={() => start(`/workouts/log?split=${d.id}`, d.name)} className="btn-soft w-full !py-2 text-sm mt-3 flex items-center justify-center gap-2" data-testid="start-day">
                <Play className="h-3.5 w-3.5" fill="currentColor" />Boshlash
              </button>
            ) : (
              <Link href={`/workouts/splits/${d.id}`} className="btn-soft w-full !py-2 text-sm mt-3 block text-center">Mashq qo'shish</Link>
            )}
          </div>
        ))}
      </div>
      <Link href={`/workouts/splits/new?program=${p.id}`} className="mt-2.5 h-12 rounded-xl border-2 border-dashed border-lime/50 text-lime text-sm flex items-center justify-center gap-1.5" data-testid="add-day">
        <Plus className="h-4 w-4" />Kun qo'shish
      </Link>

      <Link href={`/workouts/programs/${p.id}/report`} className="card p-4 mt-6 flex items-center gap-3 hover:bg-white/[0.02]" data-testid="report-link">
        <div className="h-10 w-10 rounded-xl bg-lime-muted flex items-center justify-center shrink-0"><BarChart3 className="h-5 w-5 text-lime" /></div>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">Hisobot</p><p className="text-xs text-white/40">Progress, PDF yuklash, trenerga yuborish</p></div>
      </Link>

      <button type="button" onClick={remove} className="w-full mt-6 py-3 text-sm text-red-400 flex items-center justify-center gap-1.5" data-testid="delete-program">
        <Trash2 className="h-4 w-4" />Programmani o'chirish
      </button>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-3 min-w-0">
      <p className="text-[11px] text-white/40 truncate">{label}</p>
      <p className="text-[15px] font-bold text-white truncate">{value}</p>
      <p className="text-[10px] text-white/30 truncate">{sub}</p>
    </div>
  );
}
