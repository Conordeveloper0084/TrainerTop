"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { Spinner } from "@/components/workouts/common";
import { ReportView, printReport, type Period } from "@/components/workouts/ReportView";
import { localToday } from "@/lib/workout";
import { wapi } from "@/lib/workout-client";

// Ulashilgan hisobot (trener ko'radi). Jonli: har ochilganda eng yangi natijalar. Faqat tanlangan trener va egasi kira oladi.
export default function SharedReportPage({ params }: { params: { id: string } }) {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [period, setPeriod] = useState<Period>("4w");
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    setReport(null);
    wapi(`/shared/${params.id}?period=${period}&today=${localToday()}`).then(setReport).catch((e) => setError(e.message));
  }, [user, params.id, period]);
  if (!ready) return <Spinner />;
  if (!user) return (
    <div className="container-main py-16 max-w-md text-center" data-testid="shared-login">
      <p className="text-sm text-white/60 mb-4">Progress hisobotini ko'rish uchun tizimga kiring</p>
      <Link href={`/login?redirect=/workouts/shared/${params.id}`} className="btn-lime !py-2.5 !px-6 text-sm">Kirish</Link>
    </div>
  );
  if (error) return <div className="container-main py-16 text-center" data-testid="shared-error"><p className="text-sm text-white/40">{error}</p></div>;
  if (!report) return <Spinner />;
  return (
    <div className="container-main py-6 max-w-2xl">
      <ReportView report={report} period={period} onPeriod={setPeriod}
        header={<div className="mb-4">
          <p className="text-xs text-white/40">{report.is_owner ? "Siz ulashgan hisobot" : `${report.owner?.full_name || "Shogird"} ulashgan progress hisoboti`}</p>
          <h1 className="text-page-title text-white">{report.program.name}</h1>
          <p className="text-[11px] text-lime mt-1 no-print">Jonli: har ochganingizda eng yangi natijalar ko'rinadi</p>
          <button type="button" onClick={printReport} className="no-print btn-ghost !py-2 !px-3 text-xs mt-3 inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5" />PDF yuklash</button>
        </div>} />
    </div>
  );
}
