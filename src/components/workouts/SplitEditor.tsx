"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, Minus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { WORKOUT_LIMITS, muscleLabel, type WorkoutExercise } from "@/lib/workout";
import { wapi } from "@/lib/workout-client";
import { ExercisePicker } from "@/components/workouts/ExercisePicker";
import { askConfirm } from "@/components/workouts/confirm";

type Item = WorkoutExercise & { target_sets: number };

// Kun (split) yaratish / tahrirlash: nom + mashqlar (tartibi va har birining padxodlar soni).
// Yangi kun — programId bilan. Saqlangach programma sahifasiga qaytadi.
export function SplitEditor({ split, programId, programName }: {
  split?: { id: string; name: string; program_id: string; exercises: WorkoutExercise[] }; programId?: string; programName?: string;
}) {
  const router = useRouter();
  const pid = split?.program_id ?? programId!;
  const back = `/workouts/programs/${pid}`;
  const [name, setName] = useState(split?.name ?? "");
  const [list, setList] = useState<Item[]>((split?.exercises ?? []).map((e) => ({ ...e, target_sets: e.target_sets ?? WORKOUT_LIMITS.defaultSets })));
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const closePicker = useCallback(() => setPicker(false), []);

  const move = (i: number, d: -1 | 1) => setList((l) => { const j = i + d; if (j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const setSets = (i: number, d: -1 | 1) => setList((l) => l.map((x, k) => (k !== i ? x : { ...x, target_sets: Math.min(WORKOUT_LIMITS.targetSetsMax, Math.max(WORKOUT_LIMITS.targetSetsMin, x.target_sets + d)) })));
  const removeItem = async (e: Item) => {
    if (!(await askConfirm({ title: `"${e.name}" kundan olib tashlansinmi?`, message: "Avvalgi natijalaringiz tarixda qoladi.", confirmText: "Olib tashlash" }))) return;
    setList((l) => l.filter((x) => x.id !== e.id));
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Kun nomini kiriting"); return; }
    setBusy(true);
    try {
      const exercises = list.map((e) => ({ exercise_id: e.id, target_sets: e.target_sets }));
      if (split) await wapi(`/splits/${split.id}`, { method: "PATCH", body: { name, exercises } });
      else await wapi("/splits", { method: "POST", body: { program_id: pid, name, exercises } });
      toast.success(split ? "Saqlandi" : "Kun qo'shildi");
      router.push(back);
    } catch (e: any) { toast.error(e.message); setBusy(false); }
  };
  const remove = async () => {
    if (!split) return;
    const ok = await askConfirm({ title: `"${split.name}" kuni o'chirilsinmi?`, message: "Bu kunda yozilgan mashg'ulotlaringiz tarixda va statistikada qoladi." });
    if (!ok) return;
    setBusy(true);
    try { await wapi(`/splits/${split.id}`, { method: "DELETE" }); toast.success("Kun o'chirildi"); router.push(back); }
    catch (e: any) { toast.error(e.message); setBusy(false); }
  };

  return (
    <div className="container-main py-6 max-w-xl" data-testid="split-editor">
      <Link href={back} className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white mb-4"><ChevronLeft className="h-3.5 w-3.5" />{programName || "Programma"}</Link>
      <h1 className="text-page-title text-white mb-5">{split ? "Kunni tahrirlash" : "Yangi kun"}</h1>

      <label htmlFor="split-name" className="block text-xs text-white/40 mb-1.5">Kun nomi</label>
      <input id="split-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={WORKOUT_LIMITS.splitName}
        placeholder="Masalan: Push day, Oyoq kuni, Upper A" className="input-field mb-6" data-testid="split-name" />

      <div className="flex items-baseline justify-between mb-2">
        <p className="text-sm font-semibold text-white">Mashqlar <span className="text-white/30 font-normal">({list.length})</span></p>
        {list.length > 0 && <p className="text-[11px] text-white/30">padxodlar soni</p>}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-white/30 card p-5 text-center mb-3">Hali mashq yo'q. Pastdagi tugma orqali qo'shing.</p>
      ) : (
        <div className="card divide-y divide-white/[0.06] mb-3" data-testid="split-exercises">
          {list.map((e, i) => (
            <div key={e.id} className="px-3 py-2.5" data-testid="split-exercise">
              <div className="flex items-center gap-2">
                <span className="w-5 text-xs text-white/30 text-center shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{e.name}</p>
                  {e.muscle_group !== "other" && <p className="text-[11px] text-white/30">{muscleLabel(e.muscle_group)}</p>}
                </div>
                <div className="flex items-center rounded-lg bg-white/[0.06] shrink-0" data-testid="sets-stepper">
                  <button type="button" onClick={() => setSets(i, -1)} disabled={e.target_sets <= WORKOUT_LIMITS.targetSetsMin} aria-label={`${e.name}: padxodni kamaytirish`} className="h-8 w-8 flex items-center justify-center text-white/60 disabled:opacity-20"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-5 text-center text-sm font-semibold text-white" data-testid="sets-value">{e.target_sets}</span>
                  <button type="button" onClick={() => setSets(i, 1)} disabled={e.target_sets >= WORKOUT_LIMITS.targetSetsMax} aria-label={`${e.name}: padxodni ko'paytirish`} className="h-8 w-8 flex items-center justify-center text-white/60 disabled:opacity-20"><Plus className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 mt-1 pl-7">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Yuqoriga" className="p-1.5 text-white/30 disabled:opacity-20"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Pastga" className="p-1.5 text-white/30 disabled:opacity-20"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => removeItem(e)} aria-label={`${e.name} ni olib tashlash`} className="p-1.5 text-white/30 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setPicker(true)} disabled={list.length >= WORKOUT_LIMITS.splitExercises}
        className="w-full h-14 rounded-xl border-2 border-dashed border-lime/50 text-lime text-sm flex items-center justify-center gap-1.5 disabled:opacity-30" data-testid="add-exercises">
        <Plus className="h-4 w-4" />Mashq qo'shish
      </button>

      <button type="button" onClick={save} disabled={busy} className="btn-lime w-full !py-3 text-sm mt-6 disabled:opacity-50" data-testid="save-split">
        {busy ? "Saqlanmoqda..." : split ? "Saqlash" : "Kunni qo'shish"}
      </button>
      {split && (
        <button type="button" onClick={remove} disabled={busy} className="w-full mt-3 py-3 text-sm text-red-400 flex items-center justify-center gap-1.5" data-testid="delete-split">
          <Trash2 className="h-4 w-4" />Kunni o'chirish
        </button>
      )}

      <ExercisePicker open={picker} onClose={closePicker} exclude={list.map((e) => e.id)}
        onPick={(picked) => { setList((l) => [...l, ...picked.map((p) => ({ ...p, target_sets: WORKOUT_LIMITS.defaultSets }))].slice(0, WORKOUT_LIMITS.splitExercises)); setPicker(false); }} />
    </div>
  );
}
