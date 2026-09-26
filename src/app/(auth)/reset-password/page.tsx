"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  // Havola /auth/confirm orqali sessiya ochgan bo'lishi kerak
  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setChecking(false);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Parol kamida 6 ta belgidan iborat bo'lishi kerak"); return; }
    if (password.length > 100) { toast.error("Parol juda uzun"); return; }
    if (password !== confirm) { toast.error("Parollar bir xil emas"); return; }
    setSaving(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        toast.error(/same/i.test(error.message) ? "Yangi parol eskisidan farq qilishi kerak" : "Parolni o'zgartirib bo'lmadi. Qayta urinib ko'ring");
        return;
      }
      toast.success("Parol o'zgartirildi!");
      setTimeout(() => { window.location.href = "/"; }, 800);
    } catch {
      toast.error("Xatolik yuz berdi. Qayta urinib ko'ring");
    } finally {
      setSaving(false);
    }
  };

  if (checking) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;

  if (!hasSession) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Havola eskirgan</h1>
        <p className="text-white/50 text-sm mb-6">Parolni tiklash havolasi yaroqsiz yoki muddati o'tgan. Yangisini so'rang.</p>
        <Link href="/forgot-password" className="btn-lime inline-flex items-center justify-center w-full">Yangi havola so'rash</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Yangi parol</h1>
      <p className="text-white/40 text-sm mb-8">Yangi parolingizni kiriting</p>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-sm text-white/60 mb-2">Yangi parol</label>
          <div className="relative">
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kamida 6 ta belgi" className="input-field pr-12" autoComplete="new-password" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-2">Parolni takrorlang</label>
          <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Parolni qayta kiriting" className="input-field" autoComplete="new-password" />
        </div>
        <button type="submit" disabled={saving} className="btn-lime w-full flex items-center justify-center gap-2 disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saqlanmoqda..." : "Parolni saqlash"}
        </button>
      </form>
    </div>
  );
}
