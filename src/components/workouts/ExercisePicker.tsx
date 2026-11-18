"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MUSCLE_GROUPS, matchesExercise, muscleLabel, normalizeSearch, type MuscleGroup, type WorkoutExercise } from "@/lib/workout";
import { ApiError, getExercises, wapi } from "@/lib/workout-client";
import { askConfirm } from "@/components/workouts/confirm";

// Mashq qo'shish oynasi. ASOSIY yo'l — o'z so'zi bilan yozish ("temirda anjimaniya", "arqonda pastga bosish"):
// yozilgan nom ro'yxatda bo'lmasa — "…ni qo'shish" tugmasi (bir bosishda yaratiladi va tanlanadi).
// Yozayotganda o'xshash mashqlar chiqadi (inglizcha, o'zbekcha, ruscha va mahalliy nomlar bo'yicha). Bo'sh bo'lsa — butun ro'yxat.
// exclude — allaqachon qo'shilganlar (qayta tanlanmaydi).
export function ExercisePicker({ open, onClose, onPick, exclude = [], multi = true, title = "Mashq qo'shish" }: {
  open: boolean; onClose: () => void; onPick: (list: WorkoutExercise[]) => void; exclude?: string[]; multi?: boolean; title?: string;
}) {
  const [all, setAll] = useState<WorkoutExercise[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<MuscleGroup | "all" | "mine">("all");
  const [picked, setPicked] = useState<WorkoutExercise[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ(""); setPicked([]); setGroup("all"); setError("");
    getExercises().then(setAll).catch((e) => setError(e.message || "Yuklab bo'lmadi"));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const excluded = useMemo(() => new Set(exclude), [exclude]);
  const typed = q.replace(/\s+/g, " ").trim();
  const exact = useMemo(() => (all && typed ? all.find((e) => normalizeSearch(e.name) === normalizeSearch(typed)) : undefined), [all, typed]);
  const list = useMemo(() => {
    if (!all) return [];
    const byGroup = all.filter((e) => (group === "all" ? true : group === "mine" ? e.is_custom : e.muscle_group === group));
    return typed ? byGroup.filter((e) => matchesExercise(e, typed)).slice(0, 30) : byGroup;
  }, [all, typed, group]);

  if (!open) return null;
  const isPicked = (id: string) => picked.some((p) => p.id === id);
  const choose = (e: WorkoutExercise) => {
    if (excluded.has(e.id)) return;
    if (!multi) { onPick([e]); return; }
    setPicked((p) => (p.some((x) => x.id === e.id) ? p.filter((x) => x.id !== e.id) : [...p, e]));
  };

  // O'z nomi bilan qo'shish: shu nomli o'z mashqi bo'lsa — o'sha; katalogda aynan shu nom bo'lsa — katalogdagisi
  const addTyped = async () => {
    if (!typed || busy) return;
    if (exact) { if (!isPicked(exact.id)) choose(exact); setQ(""); return; }
    setBusy(true);
    try {
      const d = await wapi<{ exercise: WorkoutExercise }>("/exercises", { method: "POST", body: { name: typed } });
      setAll(await getExercises(true).catch(() => all));
      choose(d.exercise); setQ("");
      if (multi) toast.success(`"${d.exercise.name}" tanlandi`);
    } catch (e: any) {
      const ex = e instanceof ApiError && e.status === 409 ? e.data?.exercise : null;
      if (ex) { choose(ex); setQ(""); } else toast.error(e.message);
    } finally { setBusy(false); inputRef.current?.focus(); }
  };

  const removeCustom = async (e: WorkoutExercise) => {
    const ok = await askConfirm({ title: `"${e.name}" o'chirilsinmi?`, message: "Avvalgi natijalaringiz tarixda saqlanib qoladi, lekin bu mashq ro'yxatdan yo'qoladi." });
    if (!ok) return;
    try {
      await wapi(`/exercises/${e.id}`, { method: "DELETE" });
      setAll(await getExercises(true)); setPicked((p) => p.filter((x) => x.id !== e.id));
      toast.success("Mashq o'chirildi");
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title} data-testid="exercise-picker">
      <button type="button" aria-label="Yopish" className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-dark-surface border border-white/[0.08] rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <h2 className="text-h3 text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Yopish" className="p-2 -mr-2 text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-4 pb-3 shrink-0">
          <label htmlFor="ex-name-input" className="block text-xs text-white/40 mb-1.5">Mashq nomi — o'zingiz tushunadigan qilib yozing</label>
          <form onSubmit={(e) => { e.preventDefault(); addTyped(); }} className="flex gap-2">
            <input id="ex-name-input" ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} autoComplete="off"
              placeholder="Masalan: Bench press yoki temirda anjimaniya" className="input-field !py-2.5 flex-1" data-testid="picker-search" />
          </form>
          {typed && (
            <button type="button" onClick={addTyped} disabled={busy || (!!exact && excluded.has(exact.id))} data-testid="picker-add-typed"
              className="mt-2 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-lime-subtle border border-lime/30 text-sm text-white text-left disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin text-lime shrink-0" /> : <Plus className="h-4 w-4 text-lime shrink-0" />}
              <span className="truncate">{exact ? <>Tanlash: <b>{exact.name}</b></> : <>"<b>{typed}</b>" deb qo'shish</>}</span>
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 no-scrollbar shrink-0" data-testid="picker-groups">
          {[{ id: "all", label: "Hammasi" }, ...MUSCLE_GROUPS, { id: "mine", label: "Meniki" }].map((g) => (
            <button key={g.id} type="button" onClick={() => setGroup(g.id as any)} data-active={group === g.id}
              className={cn("shrink-0 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors", group === g.id ? "bg-lime text-black font-semibold" : "bg-white/[0.06] text-white/60")}>
              {g.label}
            </button>
          ))}
        </div>
        {typed && list.length > 0 && <p className="px-4 pb-1 text-[11px] text-white/30 shrink-0">O'xshashlari:</p>}

        <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-[160px]" data-testid="picker-list">
          {error ? <p className="text-sm text-red-400 text-center py-10">{error}</p>
            : !all ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 text-lime animate-spin" /></div>
            : list.length === 0 ? <p className="text-sm text-white/40 text-center py-8 px-4">{typed ? "O'xshash mashq yo'q — yuqoridagi tugma bilan o'z nomingizda qo'shing" : "Mashq yo'q"}</p>
            : list.map((e) => {
              const disabled = excluded.has(e.id); const on = isPicked(e.id);
              return (
                <div key={e.id} className="flex items-center">
                  <button type="button" onClick={() => choose(e)} disabled={disabled} data-testid="picker-item" data-id={e.id} aria-pressed={on}
                    className={cn("flex-1 min-w-0 flex items-center gap-3 px-2 py-2.5 rounded-xl text-left transition-colors", disabled ? "opacity-40" : "hover:bg-white/[0.04]", on && "bg-lime-subtle")}>
                    <span className={cn("h-5 w-5 shrink-0 rounded-md border flex items-center justify-center", on || disabled ? "bg-lime border-lime" : "border-white/20")}>
                      {(on || disabled) && <Check className="h-3.5 w-3.5 text-black" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-white truncate">{e.name}{e.is_custom && <span className="ml-1.5 text-[10px] text-lime">meniki</span>}</span>
                      {e.name_uz && <span className="block text-xs text-white/40 truncate">{e.name_uz}</span>}
                    </span>
                    {e.muscle_group !== "other" && <span className="text-[10px] text-white/30 shrink-0">{muscleLabel(e.muscle_group)}</span>}
                  </button>
                  {e.is_custom && (
                    <button type="button" onClick={() => removeCustom(e)} aria-label={`${e.name} ni o'chirish`} className="p-2 text-white/30 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              );
            })}
        </div>
        {multi && (
          <div className="p-4 border-t border-white/[0.06] shrink-0">
            <button type="button" disabled={picked.length === 0} onClick={() => onPick(picked)} className="btn-lime w-full !py-3 text-sm disabled:opacity-30" data-testid="picker-confirm">
              {picked.length > 0 ? `Qo'shish (${picked.length})` : "Mashqni yozing yoki ro'yxatdan tanlang"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
