"use client";

import { useState } from "react";
import { X, Loader2, VolumeX, UserMinus, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOD_REASONS, MUTE_DURATIONS, MOD_NOTE_MAX, type ModReason, type MuteDuration } from "@/lib/chat-moderation";

export interface ModerationSubmit { action: "mute" | "remove" | "unmute"; reason?: ModReason; note?: string; duration?: MuteDuration }
interface Props {
  memberName: string;
  isMuted?: boolean;                         // hozir cheklangan bo'lsa — "Cheklovni olib tashlash" ham ko'rinadi
  onSubmit: (body: ModerationSubmit) => Promise<void>;
  onClose: () => void;
}

// A'zoga chora: yozishni cheklash (muddat bilan) yoki guruhdan chiqarish. SABAB majburiy.
// "Boshqa sabab" tanlansa izoh yozish majburiy. Sabab a'zoning o'ziga ko'rsatiladi.
export function ModerationDialog({ memberName, isMuted, onSubmit, onClose }: Props) {
  const [mode, setMode] = useState<"mute" | "remove">("mute");
  const [reason, setReason] = useState<ModReason | "">("");
  const [note, setNote] = useState("");
  const [duration, setDuration] = useState<MuteDuration>("1d");
  const [busy, setBusy] = useState(false);

  const noteOk = reason !== "other" || note.trim().length >= 3;
  const canSubmit = !!reason && noteOk && !busy;

  const submit = async (body: ModerationSubmit) => {
    setBusy(true);
    try { await onSubmit(body); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-label="A'zoga chora">
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-sm max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div className="min-w-0"><h2 className="font-semibold text-sm">A'zoga chora</h2><p className="text-[11px] text-white/40 truncate">{memberName}</p></div>
          <button onClick={onClose} aria-label="Yopish" className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {isMuted && (
            <button onClick={() => submit({ action: "unmute" })} disabled={busy}
              className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg border border-lime/30 text-lime hover:bg-lime/10 disabled:opacity-40">
              <Unlock className="h-3.5 w-3.5" />Cheklovni olib tashlash
            </button>
          )}

          <div className="grid grid-cols-2 gap-2" role="tablist">
            {([["mute", "Yozishni cheklash", VolumeX], ["remove", "Guruhdan chiqarish", UserMinus]] as const).map(([k, label, Icon]) => (
              <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
                className={cn("flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs", mode === k ? "border-lime/40 bg-lime/[0.06] text-lime" : "border-white/[0.08] text-white/50 hover:text-white")}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-white/40 -mt-2">
            {mode === "mute" ? "A'zo guruhni o'qiy oladi, lekin yoza olmaydi. Muddat tugagach o'zi tiklanadi." : "A'zo guruhni ko'rmaydi (chat ro'yxatida sabab bilan qoladi). Darslikka kirishi SAQLANADI. Keyin qaytarish mumkin."}
          </p>

          {mode === "mute" && (
            <div>
              <p className="text-[11px] text-white/40 mb-1.5">Muddat</p>
              <div className="flex flex-wrap gap-1.5">
                {MUTE_DURATIONS.map((d) => (
                  <button key={d.code} onClick={() => setDuration(d.code)} aria-pressed={duration === d.code}
                    className={cn("px-3 py-1.5 rounded-lg text-xs border", duration === d.code ? "bg-lime text-black border-lime font-semibold" : "border-white/[0.1] text-white/60")}>{d.label}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] text-white/40 mb-1.5">Sabab <span className="text-red-400">*</span></p>
            <div className="space-y-1.5">
              {MOD_REASONS.map((r) => (
                <label key={r.code} className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm", reason === r.code ? "border-lime/40 bg-lime/[0.05]" : "border-white/[0.08]")}>
                  <input type="radio" name="mod-reason" value={r.code} checked={reason === r.code} onChange={() => setReason(r.code)} className="accent-lime" />{r.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] text-white/40 mb-1.5">Izoh {reason === "other" ? <span className="text-red-400">* (majburiy)</span> : "(ixtiyoriy)"}</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={MOD_NOTE_MAX} rows={3} aria-label="Izoh"
              placeholder="A'zoga ko'rsatiladigan qisqa izoh..." className="input-field text-sm resize-none" />
            <p className="text-[10px] text-white/30 text-right">{note.length}/{MOD_NOTE_MAX}</p>
          </div>

          <button onClick={() => submit({ action: mode, reason: reason as ModReason, note: note.trim() || undefined, ...(mode === "mute" ? { duration } : {}) })} disabled={!canSubmit}
            className={cn("w-full py-2.5 rounded-button text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40", mode === "remove" ? "bg-red-500 text-white" : "btn-lime")}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "mute" ? "Cheklash" : "Guruhdan chiqarish"}
          </button>
        </div>
      </div>
    </div>
  );
}
