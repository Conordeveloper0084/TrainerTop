"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export const BAN_DURATIONS = [
  { key: "1d", label: "1 kun" },
  { key: "7d", label: "7 kun" },
  { key: "30d", label: "30 kun" },
  { key: "permanent", label: "Doimiy" },
] as const;

const REASONS = ["Spam yoki reklama", "Haqoratli xatti-harakat", "Firibgarlik shubhasi", "18+ yoki noqonuniy kontent"];

// Sabab yetarli bo'lsa va doimiy ban uchun "ban" so'zi yozilgan bo'lsagina tasdiqlash mumkin
export function canBan(reason: string, duration: string, confirmText: string): boolean {
  if (reason.trim().length < 5) return false;
  if (duration === "permanent") return confirmText.trim().toLowerCase() === "ban";
  return true;
}

export function BanModal({ user, onClose, onDone }: { user: { id: string; full_name: string; role: string }; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<string>("7d");
  const [confirmText, setConfirmText] = useState("");
  const [sending, setSending] = useState(false);
  const ready = canBan(reason, duration, confirmText);

  const submit = async () => {
    if (!ready || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), duration, confirm: duration === "permanent" ? "ban" : undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Xatolik");
      toast.success(`${user.full_name} ban qilindi`);
      if (d.auth_ban === false) toast.warning("Diqqat: tizimga kirishni to'sish to'liq bajarilmadi, lekin API ban amalda");
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
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0"><Ban className="h-5 w-5 text-red-400" /></div>
          <div className="min-w-0">
            <h2 className="text-base font-bold">Ban berish</h2>
            <p className="text-[11px] text-white/50 truncate">{user.full_name}</p>
          </div>
        </div>
        <div className="p-5">
          <ul className="text-[11px] text-white/50 space-y-1 mb-4 leading-relaxed">
            <li>• Tizimga kira olmaydi va hech qanday amal bajara olmaydi</li>
            <li>• Postlari, darsliklari va profili ommaviy ko'rinmaydi{user.role === "trainer" ? "; pul yecha olmaydi (balansi saqlanadi)" : ""}</li>
            <li>• Ma'lumotlari o'chirilmaydi. Banni istalgan payt olib tashlash mumkin</li>
          </ul>

          <label className="block text-xs text-white/60 mb-2">Muddat</label>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {BAN_DURATIONS.map((d) => (
              <button key={d.key} onClick={() => setDuration(d.key)} className={cn("py-2 rounded-lg text-xs border", duration === d.key ? "border-red-400 bg-red-500/10 text-red-400" : "border-white/10 text-white/50 hover:bg-white/5")}>{d.label}</button>
            ))}
          </div>

          <label className="block text-xs text-white/60 mb-2">Sabab <span className="text-red-400">*</span> <span className="text-white/30">(foydalanuvchi qoidabuzarlik sababini shu yerda bilib oladi)</span></label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={cn("px-2.5 py-1 rounded-full text-[10px] border", reason === r ? "border-lime text-lime bg-lime-muted" : "border-white/10 text-white/40 hover:bg-white/5")}>{r}</button>
            ))}
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Batafsil sabab..." className="input-field resize-none mb-4" />

          {duration === "permanent" && (
            <>
              <label className="block text-xs text-white/60 mb-2">Doimiy ban uchun <span className="font-mono text-red-400">ban</span> deb yozing</label>
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="ban" autoComplete="off" className="input-field font-mono mb-4" />
            </>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} disabled={sending} className="btn-outline flex-1 !py-2.5 text-sm">Bekor qilish</button>
            <button onClick={submit} disabled={!ready || sending} className="flex-1 bg-red-500 text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-red-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              {sending ? "Yuborilmoqda..." : "Ban berish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
