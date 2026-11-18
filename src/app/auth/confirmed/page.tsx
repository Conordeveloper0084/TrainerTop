"use client";

import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";

// Email tasdiqlangach shu sahifaga tushadi (/auth/confirm route'i yo'naltiradi).
// Website'dan ham, ilovadan ro'yxatdan o'tganlar uchun ham xizmat qiladi.
export default function ConfirmedPage() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const next = user?.role === "trainer" ? "/profile/setup" : "/trainers";

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      <div className="p-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <img src="/app-icon.png" alt="TrainerTop" className="h-9 w-9 rounded-xl" />
          <span className="text-lg font-bold tracking-tight">trainer<span className="text-lime">top</span></span>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-lime-muted flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="h-8 w-8 text-lime" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Email tasdiqlandi</h1>
          <p className="text-white/50 text-sm mb-8">Akkauntingiz faollashtirildi. Trainertop'ga xush kelibsiz!</p>

          {!ready ? (
            <Loader2 className="h-5 w-5 text-lime animate-spin mx-auto" />
          ) : user ? (
            <Link href={next} className="btn-lime inline-flex items-center justify-center w-full">Davom etish</Link>
          ) : (
            <Link href="/login" className="btn-lime inline-flex items-center justify-center w-full">Kirish</Link>
          )}

          <p className="text-white/30 text-xs mt-6">
            Ilovadan ro'yxatdan o'tgan bo'lsangiz — ilovaga qaytib, email va parolingiz bilan kiring.
          </p>
        </div>
      </div>
    </div>
  );
}
