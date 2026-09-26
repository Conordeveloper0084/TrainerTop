"use client";

import { useState } from "react";
import { X, Loader2, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOD_REASONS, MOD_NOTE_MAX, type ModReason } from "@/lib/chat-moderation";

// Xabarga shikoyat: sabab tanlanadi ("boshqa" bo'lsa izoh majburiy). Admin ko'rib chiqadi.
export function ReportDialog({ onSubmit, onClose }: { onSubmit: (b: { reason: ModReason; note?: string }) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState<ModReason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = !!reason && (reason !== "other" || note.trim().length >= 3) && !busy;
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-label="Shikoyat">
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-sm flex items-center gap-2"><Flag className="h-4 w-4 text-lime" />Xabarga shikoyat</h2>
          <button onClick={onClose} aria-label="Yopish" className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            {MOD_REASONS.map((r) => (
              <label key={r.code} className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm", reason === r.code ? "border-lime/40 bg-lime/[0.05]" : "border-white/[0.08]")}>
                <input type="radio" name="report-reason" checked={reason === r.code} onChange={() => setReason(r.code)} className="accent-lime" />{r.label}
              </label>
            ))}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={MOD_NOTE_MAX} rows={3} aria-label="Izoh" placeholder={reason === "other" ? "Izoh (majburiy)" : "Izoh (ixtiyoriy)"} className="input-field text-sm resize-none" />
          <button onClick={async () => { setBusy(true); try { await onSubmit({ reason: reason as ModReason, note: note.trim() || undefined }); } finally { setBusy(false); } }} disabled={!ok}
            className="btn-lime w-full !py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-40">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Yuborish</button>
          <p className="text-[10px] text-white/30 text-center">Shikoyat administratsiyaga boradi. Yuboruvchi ismi xabar egasiga ko'rsatilmaydi.</p>
        </div>
      </div>
    </div>
  );
}
