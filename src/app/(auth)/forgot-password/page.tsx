"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) { toast.error("Email noto'g'ri formatda"); return; }
    setSending(true);
    try {
      const supabase = createClient();
      // Havola email shablonidagi /auth/confirm?type=recovery&next=/reset-password orqali keladi
      const { error } = await supabase.auth.resetPasswordForEmail(value);
      if (error) {
        const tooMany = (error as any).status === 429 || /rate|seconds|too many/i.test(error.message);
        toast.error(tooMany ? "Juda tez-tez so'raldi. Bir daqiqa kutib qayta urinib ko'ring" : "Xatni yuborib bo'lmadi. Keyinroq qayta urinib ko'ring");
        return;
      }
      setSent(true);
    } catch {
      toast.error("Xatolik yuz berdi. Qayta urinib ko'ring");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-lime-muted flex items-center justify-center mx-auto mb-5"><Mail className="h-7 w-7 text-lime" /></div>
        <h1 className="text-2xl font-bold mb-2">Emailingizni tekshiring</h1>
        {/* Email ro'yxatdan o'tgan yoki o'tmaganini oshkor qilmaymiz */}
        <p className="text-white/50 text-sm mb-6">Agar <span className="font-medium break-all">{email.trim()}</span> ro'yxatdan o'tgan bo'lsa, parolni tiklash havolasini yubordik. Xat kelmasa «Spam» papkasini ham tekshiring.</p>
        <Link href="/login" className="text-lime text-sm hover:underline">Kirish sahifasiga qaytish</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Parolni tiklash</h1>
      <p className="text-white/40 text-sm mb-8">Emailingizni kiriting, tiklash havolasini yuboramiz</p>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-sm text-white/60 mb-2">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="input-field" autoComplete="email" />
        </div>
        <button type="submit" disabled={sending} className="btn-lime w-full flex items-center justify-center gap-2 disabled:opacity-50">
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          {sending ? "Yuborilmoqda..." : "Havola yuborish"}
        </button>
      </form>
      <p className="text-center text-sm text-white/40 mt-6"><Link href="/login" className="text-lime hover:underline">Kirish sahifasiga qaytish</Link></p>
    </div>
  );
}
