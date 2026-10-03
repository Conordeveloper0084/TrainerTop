"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const REASONS = ["18+ kontent", "Noto'g'ri yoki aldamchi ma'lumot", "Mualliflik huquqi buzilishi", "Spam yoki reklama"];

// "delete" so'zi to'g'ri yozilgan va sabab yetarli bo'lgandagina o'chirish tugmasi ochiladi
export function canRemove(reason: string, confirmText: string): boolean {
  return reason.trim().length >= 5 && confirmText.trim().toLowerCase() === "delete";
}

interface Props {
  lesson: { id: string; title: string; total_sales?: number; profiles?: { full_name?: string } | null };
  onClose: () => void;
  onDone: () => void;
}

// Darslikni olib tashlash: sabab + "delete" so'zini yozib tasdiqlash. Darslik yashiriladi, tiklash mumkin.
export function RemoveLessonModal({ lesson, onClose, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [sending, setSending] = useState(false);
  const ready = canRemove(reason, confirmText);

  const submit = async () => {
    if (!ready || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/lessons/${lesson.id}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), confirm: "delete" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Xatolik");
      toast.success("Darslik olib tashlandi. Kerak bo'lsa \"O'chirilganlar\" bo'limidan tiklash mumkin");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Xatolik");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-white/[0.04] flex items-center gap-3 bg-red-500/[0.04]">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0"><AlertTriangle className="h-5 w-5 text-red-400" /></div>
          <div className="min-w-0">
            <h2 className="text-base font-bold">Darslikni olib tashlash</h2>
            <p className="text-[11px] text-white/50 truncate">{lesson.title}{lesson.profiles?.full_name ? ` · ${lesson.profiles.full_name}` : ""}</p>
          </div>
        </div>

        <div className="p-5">
          <ul className="text-[11px] text-white/50 space-y-1 mb-4 leading-relaxed">
            <li>• Darslik saytdan darhol yashiriladi va sotib olib bo'lmaydi</li>
            <li>• Xaridlar va trener daromad tarixi <span className="text-white/70">saqlanadi</span>{lesson.total_sales ? ` (${lesson.total_sales} ta sotuv)` : ""}</li>
            <li>• Sabab trenerga yuboriladi. Xato bo'lsa <span className="text-white/70">tiklash mumkin</span></li>
          </ul>

          <label className="block text-xs text-white/60 mb-2">Sabab <span className="text-red-400">*</span></label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={cn("px-2.5 py-1 rounded-full text-[10px] border", reason === r ? "border-lime text-lime bg-lime-muted" : "border-white/10 text-white/40 hover:bg-white/5")}>{r}</button>
            ))}
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Nima uchun olib tashlanmoqda?" className="input-field resize-none mb-4" />

          <label className="block text-xs text-white/60 mb-2">Tasdiqlash uchun <span className="font-mono text-red-400">delete</span> deb yozing</label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="delete"
            autoComplete="off"
            className={cn("input-field font-mono mb-5", confirmText && !ready && confirmText.trim().toLowerCase() !== "delete" && "border-red-500/40")}
          />

          <div className="flex gap-2">
            <button onClick={onClose} disabled={sending} className="btn-outline flex-1 !py-2.5 text-sm">Bekor qilish</button>
            <button
              onClick={submit}
              disabled={!ready || sending}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-red-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {sending ? "O'chirilmoqda..." : "Olib tashlash"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
