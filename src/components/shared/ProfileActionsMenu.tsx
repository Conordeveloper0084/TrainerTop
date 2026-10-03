"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Flag, UserX } from "lucide-react";
import { toast } from "sonner";
import { ReportDialog } from "@/components/shared/ReportDialog";
import type { ModReason } from "@/lib/chat-moderation";

// Trener/atlet profil sahifasida: "..." → Shikoyat qilish / Bloklash. Bloklangach profil ko'rinishi
// shart emas (o'zini bloklab bo'lmaydi — sahifa buni chaqirmaydi), shuning uchun oddiy home'ga qaytariladi.
export function ProfileActionsMenu({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  const submitReport = async (b: { reason: ModReason; note?: string }) => {
    const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_type: "user", target_id: userId, ...b }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) toast.success("Shikoyatingiz yuborildi"); else toast.error(d.message || "Yuborilmadi");
    setReporting(false);
  };

  const block = async () => {
    if (!window.confirm(`${userName} ni bloklaysizmi? Uning posti/izohi/sharhi endi sizga ko'rinmaydi.`)) return;
    const res = await fetch("/api/blocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast.success(`${userName} bloklandi`); router.push("/"); }
    else toast.error(d.message || "Bloklab bo'lmadi");
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Ko'proq" className="p-2.5 rounded-button border border-white/20 text-white/50 hover:text-white hover:border-white/30"><MoreVertical className="h-4 w-4" /></button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-dark-surface border border-white/[0.08] rounded-xl shadow-lg py-1 w-48 text-sm">
          <button type="button" onClick={() => { setOpen(false); setReporting(true); }} className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 text-white/70"><Flag className="h-3.5 w-3.5" />Shikoyat qilish</button>
          <button type="button" onClick={() => { setOpen(false); void block(); }} className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 text-red-400"><UserX className="h-3.5 w-3.5" />Bloklash</button>
        </div>
      )}
      {reporting && <ReportDialog title={`${userName} ga shikoyat`} onClose={() => setReporting(false)} onSubmit={submitReport} />}
    </div>
  );
}
