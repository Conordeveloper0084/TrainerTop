"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store/auth-store";
import { WorkoutGate } from "@/components/workouts/WorkoutGate";
import { Spinner } from "@/components/workouts/common";
import { WORKOUT_LIMITS } from "@/lib/workout";
import { wapi } from "@/lib/workout-client";

const SUGGEST = ["Push day", "Pull day", "Leg day", "Upper", "Lower", "Ko'krak kuni", "Orqa kuni", "Oyoq kuni", "Full body"];

// Yangi programma: nomi + kunlari (kunlarga mashqlar keyin, programma sahifasidan qo'shiladi)
export default function NewProgramPage() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const router = useRouter();
  const [name, setName] = useState("");
  const [days, setDays] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  if (!ready) return <Spinner />;
  if (!user) return <WorkoutGate />;

  const setDay = (i: number, v: string) => setDays((d) => d.map((x, k) => (k === i ? v : x)));
  const addSuggested = (s: string) => setDays((d) => {
    if (d.some((x) => x.trim().toLowerCase() === s.toLowerCase())) return d;
    const empty = d.findIndex((x) => !x.trim());
    return empty >= 0 ? d.map((x, k) => (k === empty ? s : x)) : [...d, s].slice(0, WORKOUT_LIMITS.daysPerProgram);
  });
  const submit = async () => {
    const list = days.map((d) => d.trim()).filter(Boolean);
    if (!name.trim()) { toast.error("Programma nomini kiriting"); return; }
    if (list.length === 0) { toast.error("Kamida bitta kun qo'shing"); return; }
    setBusy(true);
    try {
      const d = await wapi<{ program: any }>("/programs", { method: "POST", body: { name, days: list.map((n) => ({ name: n })) } });
      toast.success("Programma yaratildi — endi kunlarga mashq qo'shing");
      router.push(`/workouts/programs/${d.program.id}`);
    } catch (e: any) { toast.error(e.message); setBusy(false); }
  };

  return (
    <div className="container-main py-6 max-w-xl" data-testid="program-new">
      <Link href="/workouts" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white mb-4"><ChevronLeft className="h-3.5 w-3.5" />Kundalik</Link>
      <h1 className="text-page-title text-white mb-5">Yangi programma</h1>
      <label htmlFor="program-name" className="block text-xs text-white/40 mb-1.5">Programma nomi</label>
      <input id="program-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={WORKOUT_LIMITS.programName}
        placeholder="Masalan: PPL, Upper/Lower, Massa uchun" className="input-field mb-6" data-testid="program-name" />

      <p className="text-sm font-semibold text-white mb-1">Kunlar</p>
      <p className="text-xs text-white/40 mb-3">Har bir mashg'ulot kunini yozing. Kunlarga mashqlarni keyingi qadamda qo'shasiz.</p>
      <div className="space-y-2 mb-3">
        {days.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 text-xs text-white/30 text-center">{i + 1}</span>
            <input value={d} onChange={(e) => setDay(i, e.target.value)} maxLength={WORKOUT_LIMITS.splitName} placeholder={`${i + 1}-kun nomi`} className="input-field !py-2.5 flex-1" data-testid="day-input" />
            <button type="button" onClick={() => setDays((x) => (x.length > 1 ? x.filter((_, k) => k !== i) : [""]))} aria-label={`${i + 1}-kunni olib tashlash`} className="p-2 text-white/30 hover:text-red-400"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setDays((d) => [...d, ""].slice(0, WORKOUT_LIMITS.daysPerProgram))} disabled={days.length >= WORKOUT_LIMITS.daysPerProgram}
        className="w-full h-11 rounded-xl border-2 border-dashed border-lime/50 text-lime text-sm flex items-center justify-center gap-1.5 disabled:opacity-30" data-testid="add-day">
        <Plus className="h-4 w-4" />Kun qo'shish
      </button>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {SUGGEST.map((s) => <button key={s} type="button" onClick={() => addSuggested(s)} className="px-2.5 py-1 rounded-full bg-white/[0.06] text-xs text-white/60 hover:text-white">+ {s}</button>)}
      </div>
      <button type="button" onClick={submit} disabled={busy} className="btn-lime w-full !py-3 text-sm mt-7 disabled:opacity-50" data-testid="create-program">{busy ? "Yaratilmoqda..." : "Programmani yaratish"}</button>
    </div>
  );
}
