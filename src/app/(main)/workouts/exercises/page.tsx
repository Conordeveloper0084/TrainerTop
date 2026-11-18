"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { WorkoutGate } from "@/components/workouts/WorkoutGate";
import { Spinner } from "@/components/workouts/common";
import { formatKg, localToday, matchesExercise, muscleLabel, relativeDay } from "@/lib/workout";
import { wapi } from "@/lib/workout-client";

// Progress: bajarilgan har mashq — necha marta, oxirgi sana, eng og'ir vazn va boshlaganidan beri o'zgarish. Bosilsa — grafik va tarix.
export default function ProgressPage() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [list, setList] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const today = localToday();
  useEffect(() => { if (user) wapi<{ exercises: any[] }>("/progress").then((d) => setList(d.exercises)).catch((e) => setError(e.message)); }, [user]);
  const shown = useMemo(() => (list || []).filter((x) => matchesExercise(x.exercise, q)), [list, q]);

  if (!ready) return <Spinner />;
  if (!user) return <WorkoutGate />;
  return (
    <div className="container-main py-6 max-w-2xl" data-testid="progress">
      <Link href="/workouts" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white mb-4"><ChevronLeft className="h-3.5 w-3.5" />Kundalik</Link>
      <h1 className="text-page-title text-white mb-1">Progress</h1>
      <p className="text-xs text-white/40 mb-5">Mashqni tanlang — kuchingiz qanday o'zgarganini ko'rasiz</p>
      {list === null ? (error ? <p className="text-sm text-white/40 text-center py-10">{error}</p> : <Spinner />) : list.length === 0 ? (
        <p className="text-sm text-white/30 card p-6 text-center">Birinchi mashg'ulotingizni yozganingizdan keyin bu yerda progress paydo bo'ladi</p>
      ) : (
        <>
          {list.length > 6 && (
            <div className="relative mb-3">
              <Search className="h-4 w-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mashqni qidirish" className="input-field !pl-9 !py-2.5" />
            </div>
          )}
          <div className="card divide-y divide-white/[0.06]">
            {shown.map((x) => (
              <Link key={x.exercise.id} href={`/workouts/exercises/${x.exercise.id}`} className="flex items-center gap-3 p-4 hover:bg-white/[0.02]" data-testid="progress-row">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{x.exercise.name}</p>
                  <p className="text-xs text-white/40">{muscleLabel(x.exercise.muscle_group)} · {x.sessions_count} marta · {relativeDay(x.last_date, today)}</p>
                </div>
                <div className="text-right shrink-0" data-testid="progress-value">
                  {x.exercise.is_bodyweight && Number(x.max_weight) === 0 ? (
                    <><p className="text-sm font-bold text-white">{x.max_reps} takror</p>
                      <Since d={(x.last_max_reps ?? 0) - (x.first_max_reps ?? 0)} unit="takror" n={x.sessions_count} /></>
                  ) : (
                    <><p className="text-sm font-bold text-white">{formatKg(Number(x.max_weight))} kg</p>
                      <Since d={Number(x.last_max_weight ?? 0) - Number(x.first_max_weight ?? 0)} unit="kg" n={x.sessions_count} /></>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// "Boshlaganidan beri" o'zgarish (birinchi mashg'ulot → oxirgisi). Bitta mashg'ulot bo'lsa — "eng og'ir".
function Since({ d, unit, n }: { d: number; unit: string; n: number }) {
  if (n < 2) return <p className="text-[10px] text-white/30">eng og'ir</p>;
  const v = Math.round(d * 100) / 100;
  return <p className={v > 0 ? "text-[10px] text-lime" : v < 0 ? "text-[10px] text-red-400" : "text-[10px] text-white/30"}>{v > 0 ? `+${formatKg(v)} ${unit}` : v < 0 ? `${formatKg(v)} ${unit}` : "o'zgarmagan"}</p>;
}
