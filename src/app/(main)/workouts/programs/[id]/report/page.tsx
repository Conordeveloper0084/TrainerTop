"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { WorkoutGate } from "@/components/workouts/WorkoutGate";
import { ErrorBox, Spinner } from "@/components/workouts/common";
import { ReportView, type Period } from "@/components/workouts/ReportView";
import { localToday } from "@/lib/workout";
import { wapi } from "@/lib/workout-client";

// Programma hisoboti (egasi): davr, xulosa, mashqlar o'sishi, PDF, trenerga yuborish
export default function ProgramReportPage({ params }: { params: { id: string } }) {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [period, setPeriod] = useState<Period>("4w");
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    setReport(null);
    wapi(`/programs/${params.id}/report?period=${period}&today=${localToday()}`).then(setReport).catch((e) => setError(e.message));
  }, [user, params.id, period]);
  if (!ready) return <Spinner />;
  if (!user) return <WorkoutGate />;
  if (error) return <ErrorBox message={error} />;
  return (
    <div className="container-main py-6 max-w-2xl">
      <Link href={`/workouts/programs/${params.id}`} className="no-print inline-flex items-center gap-1 text-xs text-white/40 hover:text-white mb-4"><ChevronLeft className="h-3.5 w-3.5" />Programma</Link>
      {!report ? <Spinner /> : (
        <ReportView report={report} period={period} onPeriod={setPeriod} owner={{ programId: params.id }}
          header={<><p className="text-xs text-white/40">Progress hisoboti</p><h1 className="text-page-title text-white mb-4">{report.program.name}</h1></>} />
      )}
    </div>
  );
}
