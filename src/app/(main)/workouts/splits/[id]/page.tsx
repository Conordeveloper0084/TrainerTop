"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth-store";
import { WorkoutGate } from "@/components/workouts/WorkoutGate";
import { SplitEditor } from "@/components/workouts/SplitEditor";
import { Spinner } from "@/components/workouts/common";
import { wapi } from "@/lib/workout-client";

export default function EditSplitPage({ params }: { params: { id: string } }) {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [split, setSplit] = useState<any>(null);
  const [programName, setProgramName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    wapi(`/splits/${params.id}`).then((d: any) => {
      setSplit(d.split);
      wapi(`/programs/${d.split.program_id}`).then((p: any) => setProgramName(p.program.name)).catch(() => {});
    }).catch((e) => setError(e.message));
  }, [user, params.id]);
  if (!ready) return <Spinner />;
  if (!user) return <WorkoutGate />;
  if (error) return <div className="container-main py-16 text-center"><p className="text-sm text-white/40 mb-4">{error}</p><Link href="/workouts" className="btn-soft !py-2 !px-5 text-sm">Kundalikka qaytish</Link></div>;
  if (!split) return <Spinner />;
  return <SplitEditor split={split} programName={programName} />;
}
