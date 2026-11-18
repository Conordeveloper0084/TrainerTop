"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, Minus, Plus, TrendingUp, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { WorkoutGate } from "@/components/workouts/WorkoutGate";
import { ExercisePicker } from "@/components/workouts/ExercisePicker";
import { Spinner } from "@/components/workouts/common";
import { askConfirm } from "@/components/workouts/confirm";
import {
  formatDateUz, formatKg, formatSets, localToday, outcomeText, parseReps, parseWeight, setBadge, suggestNext,
  WORKOUT_LIMITS, type Outcome, type PrevBest, type WorkoutExercise, type WSet,
} from "@/lib/workout";
import {
  ApiError, NOTHING_TO_SAVE, cleanRepsInput, cleanWeightInput, clearDraft, draftToPayload, effectiveSet, emptySets, loadDraft, newId, saveDraft, wapi,
  type Draft, type DraftSet,
} from "@/lib/workout-client";

type Prev = Record<string, { performed_on: string; sets: WSet[] }>;
type Bests = Record<string, PrevBest>;

export default function LogPage() {
  return <Suspense fallback={<Spinner />}><LogScreen /></Suspense>;
}

// MASHG'ULOT YOZISH: har mashq tepasida "Oldingi" natija, maydonlarda oldingi qiymatlar (placeholder) — ✓ bosilsa o'shalar yoziladi.
// Taymer yo'q: bu kundalik — mashg'ulot paytida ham, keyin ham yozish mumkin. Padxodlar soni — kun sozlamasidan (1–10).
// Har padxod yonida jonli yutuq belgisi (o'tgan safargi shu padxodga nisbatan: +kg / +takror / rekord).
// Hammasi qurilmada qoralama sifatida saqlanadi (sahifa yopilsa / internet uzilsa ham yo'qolmaydi).
function LogScreen() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const router = useRouter();
  const sp = useSearchParams();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [prev, setPrev] = useState<Prev>({});
  const [bests, setBests] = useState<Bests>({});
  const [loadError, setLoadError] = useState("");
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [waitingNet, setWaitingNet] = useState(false);
  const [result, setResult] = useState<{ session: any; achievements: Outcome[] } | null>(null);
  const today = localToday();
  const initRef = useRef(false);

  const loadPrev = useCallback(async (d: Draft) => {
    const ids = d.exercises.map((e) => e.exercise.id);
    if (ids.length === 0) return;
    const qs = `exercise_ids=${ids.join(",")}${d.editing ? `&exclude=${d.id}&before=${d.performed_on}` : ""}`;
    try {
      const r = await wapi<{ previous: Prev; bests: Bests }>(`/previous?${qs}`);
      setPrev((p) => ({ ...p, ...r.previous })); setBests((b) => ({ ...b, ...r.bests }));
    } catch { /* oldingi natijasiz ham yozish mumkin */ }
  }, []);

  // Boshlash: mavjud qoralama (agar ?new=1 bo'lmasa) → tahrirlash (?session=) → split (?split=) → erkin
  useEffect(() => {
    if (!user || initRef.current) return;
    initRef.current = true;
    const existing = loadDraft(user.id);
    const wantNew = sp.get("new") === "1";
    if (existing && !wantNew) {
      const asked = sp.get("session") || sp.get("split");
      if (asked && asked !== existing.id && asked !== existing.split_id) toast.info(`Avval tugallanmagan mashg'ulotni yakunlang: "${existing.title}"`);
      setDraft(existing); loadPrev(existing); return;
    }
    if (existing && wantNew) clearDraft(user.id);
    const base = { v: 1 as const, user_id: user.id, started_at: Date.now(), note: "" };
    (async () => {
      try {
        const sessionId = sp.get("session"), splitId = sp.get("split");
        let d: Draft;
        if (sessionId) {
          const { session } = await wapi<{ session: any }>(`/sessions/${sessionId}`);
          d = { ...base, id: session.id, split_id: session.split_id, title: session.title, performed_on: session.performed_on, editing: true, note: session.note || "",
            duration_sec: session.duration_sec,
            exercises: session.exercises.map((x: any) => ({ exercise: x.exercise, sets: x.sets.map((s: WSet) => ({ weight: formatKg(s.weight_kg), reps: String(s.reps), done: true })) })) } as Draft;
        } else if (splitId) {
          const { split } = await wapi<{ split: any }>(`/splits/${splitId}`);
          // Padxodlar soni — kun sozlamasidan (izolyatsion mashqlarga 1–2 qo'yish mumkin)
          d = { ...base, id: newId(), split_id: split.id, title: split.name, performed_on: localToday(), editing: false,
            exercises: split.exercises.map((e: WorkoutExercise) => ({ exercise: e, sets: emptySets(e.target_sets || WORKOUT_LIMITS.defaultSets) })) };
        } else {
          d = { ...base, id: newId(), split_id: null, title: "Erkin mashg'ulot", performed_on: localToday(), editing: false, exercises: [] };
        }
        loadPrev(d);
        setDraft(d);
      } catch (e: any) { setLoadError(e.message || "Yuklab bo'lmadi"); }
    })();
  }, [user, sp, loadPrev]);

  // Har o'zgarish — qurilmaga
  useEffect(() => { if (draft && !result) saveDraft(draft); }, [draft, result]);

  const update = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));
  const setSet = (ei: number, si: number, patch: Partial<DraftSet>) =>
    update((d) => ({ ...d, exercises: d.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((s, k) => (k === si ? { ...s, ...patch } : s)) })) }));

  // Placeholder: oldingi safardagi shu padxod → oldingi safarning oxirgi padxodi → shu mashg'ulotdagi tepadagi qator
  const placeholder = useCallback((exId: string, i: number, d: Draft | null = draft): { weight?: string; reps?: string } => {
    const p = prev[exId]?.sets;
    if (p && p.length > 0) { const s = p[Math.min(i, p.length - 1)]; return { weight: formatKg(s.weight_kg), reps: String(s.reps) }; }
    const ex = d?.exercises.find((e) => e.exercise.id === exId);
    if (ex && i > 0) { const up = ex.sets[i - 1]; return { weight: up.weight || undefined, reps: up.reps || undefined }; }
    return {};
  }, [prev, draft]);

  const toggleDone = (ei: number, si: number) => {
    if (!draft) return;
    const ex = draft.exercises[ei]; const s = ex.sets[si];
    if (s.done) { setSet(ei, si, { done: false }); return; }
    const v = effectiveSet(s, placeholder(ex.exercise.id, si));
    if (!v.reps) { toast.error("Takror sonini kiriting"); return; }
    if (!v.weight && !ex.exercise.is_bodyweight) { toast.error("Og'irlikni kiriting"); return; }
    setSet(ei, si, { weight: v.weight, reps: v.reps, done: true });
  };
  const addSet = (ei: number) => update((d) => ({ ...d, exercises: d.exercises.map((e, i) => (i !== ei || e.sets.length >= WORKOUT_LIMITS.setsPerExercise ? e : { ...e, sets: [...e.sets, { weight: "", reps: "", done: false }] })) }));
  // Oxirgi padxodni olib tashlash: unda ma'lumot bo'lsa — tasdiq so'raladi; bo'sh qator — darhol
  const removeLastSet = async (ei: number) => {
    const ex = draft?.exercises[ei];
    if (!ex || ex.sets.length <= 1) return;
    const last = ex.sets[ex.sets.length - 1];
    if ((last.done || last.reps || last.weight) && !(await askConfirm({ title: `${ex.sets.length}-padxod o'chirilsinmi?`, message: "Unga kiritilgan qiymatlar o'chadi." }))) return;
    update((d) => ({ ...d, exercises: d.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.slice(0, -1) })) }));
  };
  const removeExercise = async (ei: number) => {
    const ex = draft?.exercises[ei];
    if (!ex) return;
    if (!(await askConfirm({ title: `"${ex.exercise.name}" olib tashlansinmi?`, message: "Bu mashg'ulotdan olib tashlanadi (kunning o'zi o'zgarmaydi).", confirmText: "Olib tashlash" }))) return;
    update((d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== ei) }));
  };
  const addExercises = (list: WorkoutExercise[]) => {
    setPicker(false);
    if (!draft) return;
    const nd = { ...draft, exercises: [...draft.exercises, ...list.map((e) => ({ exercise: e, sets: emptySets(3) }))].slice(0, WORKOUT_LIMITS.sessionExercises) };
    setDraft(nd);
    loadPrev({ ...nd, exercises: list.map((e) => ({ exercise: e, sets: [] })) });
  };
  const closePicker = useCallback(() => setPicker(false), []);

  const payload = useMemo(() => (draft ? draftToPayload(draft, (id, i) => placeholder(id, i)) : null), [draft, placeholder]);
  const setsCount = payload && payload.ok ? payload.count : 0;
  // Hech narsa kiritilmagan bo'lsa — tugma o'chiq; qatorda xato bo'lsa — yoqiq, bosilganda xatoni aytadi
  const nothing = !payload || ("message" in payload && payload.message === NOTHING_TO_SAVE);

  const submit = useCallback(async () => {
    if (!draft || saving) return;
    const p = draftToPayload(draft, (id, i) => placeholder(id, i));
    if ("message" in p) { toast.error(p.message); return; }
    setSaving(true);
    try {
      const r = await wapi<{ session: any; achievements: Outcome[] }>(`/sessions?today=${localToday()}`, { method: "POST", body: {
        id: draft.id, split_id: draft.split_id, title: draft.title, performed_on: draft.performed_on, note: draft.note,
        duration_sec: draft.editing ? draft.duration_sec ?? null : null, exercises: p.exercises,
      } });
      clearDraft(draft.user_id);
      setWaitingNet(false);
      setResult(r);
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 0) {
        setWaitingNet(true);
        toast.error("Internet yo'q. Mashg'ulot shu qurilmada saqlangan — internet qaytganda o'zi yuboriladi");
      } else toast.error(e.message);
    } finally { setSaving(false); }
  }, [draft, saving, placeholder]);

  // Internet qaytganda — avtomatik qayta yuborish
  useEffect(() => {
    if (!waitingNet) return;
    const on = () => submit();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [waitingNet, submit]);

  const discard = async () => {
    if (!draft) return;
    const ok = await askConfirm(draft.editing
      ? { title: "O'zgarishlar saqlanmasinmi?", message: "Mashg'ulot avvalgi holicha qoladi.", confirmText: "Saqlamaslik" }
      : { title: "Mashg'ulot bekor qilinsinmi?", message: "Kiritilgan padxodlar o'chadi.", confirmText: "Bekor qilish", cancelText: "Davom etish" });
    if (!ok) return;
    clearDraft(draft.user_id);
    router.push(draft.editing ? `/workouts/history/${draft.id}` : "/workouts");
  };

  if (!ready) return <Spinner />;
  if (!user) return <WorkoutGate />;
  if (result) return <ResultView result={result} today={today} />;
  if (loadError) return <div className="container-main py-16 text-center"><p className="text-sm text-white/40 mb-4">{loadError}</p><Link href="/workouts" className="btn-soft !py-2 !px-5 text-sm">Kundalikka qaytish</Link></div>;
  if (!draft) return <Spinner />;

  return (
    <div className="container-main py-5 max-w-xl pb-32" data-testid="log-screen">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/workouts" aria-label="Kundalik" className="p-1.5 -ml-1.5 text-white/40 hover:text-white"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="text-h2 text-white truncate flex-1" data-testid="log-title">{draft.editing ? `Tahrirlash: ${draft.title}` : draft.title}</h1>
      </div>
      <div className="flex items-center gap-2 mb-5 pl-8">
        <label htmlFor="log-date" className="text-xs text-white/40">Sana</label>
        <input id="log-date" type="date" value={draft.performed_on} max={today} data-testid="log-date"
          onChange={(e) => { const v = e.target.value; if (v) update((d) => ({ ...d, performed_on: v })); }}
          className="bg-transparent text-xs text-white border border-white/10 rounded-lg px-2 py-1" />
      </div>
      {waitingNet && <p className="text-xs text-amber-400 mb-4 card p-3 border-amber-400/30" data-testid="offline-note">Internet kutilmoqda — mashg'ulot shu qurilmada saqlangan, aloqa tiklanganda yuboriladi.</p>}

      {draft.exercises.length === 0 && <p className="text-sm text-white/30 card p-6 text-center mb-3">Mashq qo'shing va padxodlarni yozishni boshlang</p>}

      <div className="space-y-3">
        {draft.exercises.map((ex, ei) => {
          const p = prev[ex.exercise.id];
          const target = p ? suggestNext(p.sets, ex.exercise.is_bodyweight) : null;
          return (
            <div key={ex.exercise.id} className="card p-3.5" data-testid="log-exercise">
              <div className="flex items-start gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-white truncate">{ex.exercise.name}</p>
                  <p className="text-xs text-white/40 mt-0.5" data-testid="prev-line">
                    {p ? <>Oldingi ({formatDateUz(p.performed_on, today)}): <span className="text-white/70">{formatSets(p.sets, ex.exercise.is_bodyweight)}</span></> : "Birinchi marta — natijangizni yozing"}
                  </p>
                  {target && <p className="text-xs text-lime mt-0.5" data-testid="target-line">Maqsad: {target.text}</p>}
                </div>
                <button type="button" onClick={() => removeExercise(ei)} aria-label={`${ex.exercise.name} ni olib tashlash`} className="p-1.5 -mr-1 text-white/30 hover:text-red-400"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-[22px_1fr_1fr_40px] gap-2 px-0.5 text-[10px] uppercase tracking-wide text-white/30 mb-1">
                <span className="text-center">#</span><span>{ex.exercise.is_bodyweight ? "+ kg" : "kg"}</span><span>Takror</span><span />
              </div>
              <div className="space-y-1.5">
                {ex.sets.map((s, si) => {
                  const ph = placeholder(ex.exercise.id, si);
                  const touched = s.done || s.reps.trim() !== "" || s.weight.trim() !== "";
                  // Jonli yutuq: o'tgan safargi SHU raqamli padxodga nisbatan (+kg / +takror / rekord)
                  let badge = null;
                  if (touched) {
                    const v = effectiveSet(s, ph); const w = v.weight.trim() === "" ? 0 : parseWeight(v.weight); const r = parseReps(v.reps);
                    if (w !== null && r !== null) badge = setBadge({ weight_kg: w, reps: r }, prev[ex.exercise.id]?.sets[si], bests[ex.exercise.id], ex.exercise.is_bodyweight);
                  }
                  return (
                    <div key={si}>
                      <div className={cn("grid grid-cols-[22px_1fr_1fr_40px] gap-2 items-center rounded-lg", s.done && "bg-lime-subtle")} data-testid="set-row" data-done={s.done}>
                        <span className="text-xs text-white/40 text-center">{si + 1}</span>
                        <input inputMode="decimal" value={s.weight} placeholder={ph.weight ?? (ex.exercise.is_bodyweight ? "0" : "kg")} aria-label={`${si + 1}-padxod og'irligi`}
                          onChange={(e) => setSet(ei, si, { weight: cleanWeightInput(e.target.value), done: false })} data-testid="set-weight"
                          className="set-input h-10 w-full min-w-0 bg-dark-card rounded-lg px-3 text-[15px] text-white border border-white/[0.06] focus:border-lime focus:outline-none" />
                        <input inputMode="numeric" value={s.reps} placeholder={ph.reps ?? "takror"} aria-label={`${si + 1}-padxod takrori`}
                          onChange={(e) => setSet(ei, si, { reps: cleanRepsInput(e.target.value), done: false })} data-testid="set-reps"
                          className="set-input h-10 w-full min-w-0 bg-dark-card rounded-lg px-3 text-[15px] text-white border border-white/[0.06] focus:border-lime focus:outline-none" />
                        <button type="button" onClick={() => toggleDone(ei, si)} aria-pressed={s.done} aria-label={`${si + 1}-padxod bajarildi`} data-testid="set-done"
                          className={cn("h-10 w-10 rounded-lg flex items-center justify-center transition-colors", s.done ? "bg-lime text-black" : "bg-white/[0.06] text-white/40")}>
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </button>
                      </div>
                      {badge && (
                        <p className={cn("text-[11px] font-semibold pl-8 mt-0.5 flex items-center gap-1", badge.kind === "record" ? "text-amber-400" : "text-lime")} data-testid="set-badge" data-kind={badge.kind}>
                          {badge.kind === "record" ? <Trophy className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                          {badge.text}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button type="button" onClick={() => removeLastSet(ei)} disabled={ex.sets.length <= 1} className="py-2 text-xs text-white/50 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] flex items-center justify-center gap-1 disabled:opacity-30" data-testid="remove-set"><Minus className="h-3 w-3" />Padxod</button>
                <button type="button" onClick={() => addSet(ei)} disabled={ex.sets.length >= WORKOUT_LIMITS.setsPerExercise} className="py-2 text-xs text-lime rounded-lg bg-lime-subtle flex items-center justify-center gap-1 disabled:opacity-30" data-testid="add-set"><Plus className="h-3 w-3" />Padxod</button>
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={() => setPicker(true)} disabled={draft.exercises.length >= WORKOUT_LIMITS.sessionExercises}
        className="w-full h-14 mt-3 rounded-xl border-2 border-dashed border-lime/50 text-lime text-sm flex items-center justify-center gap-1.5 disabled:opacity-30" data-testid="log-add-exercise">
        <Plus className="h-4 w-4" />Mashq qo'shish
      </button>

      <label htmlFor="log-note" className="block text-xs text-white/40 mt-5 mb-1.5">Izoh (ixtiyoriy)</label>
      <textarea id="log-note" value={draft.note} maxLength={WORKOUT_LIMITS.note} rows={2} onChange={(e) => update((d) => ({ ...d, note: e.target.value }))}
        placeholder="Masalan: o'zimni yaxshi his qildim, yelka biroz og'ridi" className="input-field resize-none text-sm" />

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-dark-surface/95 backdrop-blur-xl border-t border-white/[0.06] pb-safe">
        <div className="container-main max-w-xl flex gap-2 py-3">
          <button type="button" onClick={discard} className="btn-ghost !py-3 !px-4 text-sm" data-testid="discard">{draft.editing ? "Bekor" : "Bekor qilish"}</button>
          <button type="button" onClick={submit} disabled={saving || nothing} className="btn-lime flex-1 !py-3 text-sm disabled:opacity-30" data-testid="finish">
            {saving ? "Saqlanmoqda..." : draft.editing ? `Saqlash (${setsCount} padxod)` : setsCount > 0 ? `Tugatish (${setsCount} padxod)` : "Tugatish"}
          </button>
        </div>
      </div>

      <ExercisePicker open={picker} onClose={closePicker} exclude={draft.exercises.map((e) => e.exercise.id)} onPick={addExercises} />
    </div>
  );
}

function ResultView({ result, today }: { result: { session: any; achievements: Outcome[] }; today: string }) {
  const s = result.session;
  const names: Record<string, string> = Object.fromEntries((s.exercises || []).map((x: any) => [x.exercise.id, x.exercise.name]));
  const list = result.achievements || [];
  const records = list.filter((o) => o.type === "record").length;
  return (
    <div className="container-main py-8 max-w-xl" data-testid="log-result">
      <div className="text-center mb-6">
        <div className={cn("h-16 w-16 rounded-full mx-auto flex items-center justify-center mb-3", list.length > 0 ? "bg-lime" : "bg-lime-muted")}>
          {list.length > 0 ? <Trophy className="h-8 w-8 text-black" /> : <Check className="h-8 w-8 text-lime" strokeWidth={3} />}
        </div>
        <h1 className="text-page-title text-white">{list.length > 0 ? "Zo'r! O'sish bor" : "Mashg'ulot saqlandi!"}</h1>
        <p className="text-sm text-white/40 mt-1">{s.title} · {formatDateUz(s.performed_on, today)}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Stat label="Mashqlar" value={String((s.exercises || []).length)} />
        <Stat label="Padxodlar" value={String(s.sets_count)} />
        <Stat label="Yutuqlar" value={String(list.length)} lime={list.length > 0} />
      </div>
      {list.length > 0 ? (
        <div className="card p-4 mb-5 border-lime/40" data-testid="achievement-list">
          <p className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Trophy className="h-4 w-4 text-lime" />Bugungi yutuqlar{records > 0 ? ` · ${records} ta rekord` : ""}</p>
          <div className="space-y-2.5">
            {list.map((o) => (
              <div key={o.exercise_id} className="text-sm" data-testid="achievement-item" data-type={o.type}>
                <p className="text-white font-medium">{names[o.exercise_id] || "Mashq"}</p>
                <p className={cn("text-xs", o.type === "record" ? "text-amber-400" : "text-lime")}>{outcomeText(o)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-white/40 card p-4 mb-5 text-center">Har safar yozib borsangiz, keyingi mashg'ulotda o'sish shu yerda ko'rinadi.</p>
      )}
      <Link href="/workouts" className="btn-lime w-full !py-3 text-sm block text-center">Kundalikka qaytish</Link>
      <Link href={`/workouts/history/${s.id}`} className="btn-ghost w-full !py-3 text-sm block text-center mt-2">Mashg'ulotni ko'rish</Link>
    </div>
  );
}

function Stat({ label, value, lime }: { label: string; value: string; lime?: boolean }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-[11px] text-white/40">{label}</p>
      <p className={cn("text-[15px] font-bold mt-0.5 truncate", lime ? "text-lime" : "text-white")}>{value}</p>
    </div>
  );
}
