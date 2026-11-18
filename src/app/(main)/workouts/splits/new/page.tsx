"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { WorkoutGate } from "@/components/workouts/WorkoutGate";
import { SplitEditor } from "@/components/workouts/SplitEditor";
import { Spinner } from "@/components/workouts/common";
import { wapi } from "@/lib/workout-client";

export default function NewSplitPage() {
  return <Suspense fallback={<Spinner />}><NewSplit /></Suspense>;
}

// Programmaga yangi kun: /workouts/splits/new?program={id}
function NewSplit() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const programId = useSearchParams().get("program") || "";
  const [program, setProgram] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    if (!programId) { setError("Programma tanlanmagan"); return; }
    wapi(`/programs/${programId}`).then((d: any) => setProgram(d.program)).catch((e) => setError(e.message));
  }, [user, programId]);
  if (!ready) return <Spinner />;
  if (!user) return <WorkoutGate />;
  if (error) return <div className="container-main py-16 text-center"><p className="text-sm text-white/40 mb-4">{error}</p><Link href="/workouts" className="btn-soft !py-2 !px-5 text-sm">Kundalikka qaytish</Link></div>;
  if (!program) return <Spinner />;
  return <SplitEditor programId={program.id} programName={program.name} />;
}
