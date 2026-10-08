"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store/auth-store";
import { createClient } from "@/lib/supabase/client";

// /delete-account sahifasining interaktiv qismi: tizimga kirgan bo'lsa, shu yerning o'zida
// hisobni o'chirish tugmasi ko'rsatiladi (xuddi Profil → Sozlamalardagi bilan bir xil DELETE
// /api/account so'rovidan foydalanadi). Kirmagan bo'lsa — hech narsa ko'rsatmaydi (sahifadagi
// "ilova/sayt orqali o'chirish" va "yozib murojaat qilish" yo'riqnomalari asosiy qoladi).
export function DeleteAccountPanel() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Hisobni o'chirib bo'lmadi"); setShowConfirm(false); return; }
      const supabase = createClient();
      await supabase.auth.signOut();
      useAuthStore.getState().logout();
      toast.success("Hisobingiz o'chirildi");
      window.location.href = "/";
    } catch { toast.error("Hisobni o'chirib bo'lmadi"); } finally { setDeleting(false); }
  };

  if (!ready) return null;
  if (!user) return null;

  return (
    <div className="card p-5 border border-red-500/20 bg-red-500/[0.03] mb-10">
      <p className="text-sm text-white/70 mb-1">
        Siz hozir <span className="text-white font-medium">{user.full_name}</span> sifatida tizimga kirgansiz.
      </p>
      <p className="text-xs text-white/40 mb-4">Hisobingizni shu yerning o'zidan, saytdan chiqmasdan turib o'chirishingiz mumkin.</p>
      <button type="button" onClick={() => setShowConfirm(true)} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300">
        <Trash2 className="h-4 w-4" />Hisobimni hozir o'chirish
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-label="Hisobni o'chirish">
          <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-sm p-5">
            <h3 className="font-semibold text-sm mb-2 text-red-400">Hisobni butunlay o'chirasizmi?</h3>
            <p className="text-xs text-white/50 mb-4">Bu amalni qaytarib bo'lmaydi. Hisobingizga qayta kira olmaysiz. Xarid/sharh tarixingiz statistika uchun anonim holda saqlanadi.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowConfirm(false)} disabled={deleting} className="btn-outline flex-1 !py-2.5 text-sm disabled:opacity-40">Bekor qilish</button>
              <button type="button" onClick={handleDelete} disabled={deleting} className="flex-1 !py-2.5 text-sm rounded-button bg-red-500 text-white flex items-center justify-center gap-2 disabled:opacity-40">{deleting && <Loader2 className="h-4 w-4 animate-spin" />}Ha, o'chirish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
