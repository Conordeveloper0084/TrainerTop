"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Dumbbell, User, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import GoogleButton from "@/components/auth/GoogleButton";
import TelegramLoginButton from "@/components/auth/TelegramLoginButton";
import { GOOGLE_LOGIN_ENABLED } from "@/lib/features";

// Ro'yxatdan o'tish: ASOSIY yo'l — Telegram (raqam botda "📱 Raqamni ulashish" bilan tasdiqlanadi). Email bilan ro'yxatdan o'tish OLIB TASHLANGAN
// (mavjud email akkauntlari /login → "Boshqa usul bilan kirish" orqali kiradi).
export default function RegisterPage() {
  const [pageReady, setPageReady] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const searchParams = useSearchParams();
  const [role, setRole] = useState<"user" | "trainer">(searchParams.get("role") === "trainer" ? "trainer" : "user");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = "/";
      else setPageReady(true);
    });
  }, []);

  if (!pageReady) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;

  const roleBtn = (value: "user" | "trainer", Icon: any, title: string, hint: string) => (
    <button type="button" onClick={() => setRole(value)} data-testid={`role-${value}`} aria-pressed={role === value}
      className={cn("flex flex-col items-center gap-2 p-4 rounded-xl border transition-all", role === value ? "border-lime bg-lime-muted" : "border-white/10 hover:border-white/20")}>
      <Icon className={cn("h-6 w-6", role === value ? "text-lime" : "text-white/40")} />
      <span className={cn("text-sm font-medium", role === value ? "text-lime" : "text-white/60")}>{title}</span>
      <span className="text-[10px] text-white/30">{hint}</span>
    </button>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{role === "trainer" ? "Trener sifatida ro'yxatdan o'ting" : "Ro'yxatdan o'tish"}</h1>
      <p className="text-white/40 text-sm mb-8">{role === "trainer" ? "Profilingizni oching, shogirdlar toping" : "Trainertop platformasiga qo'shiling"}</p>

      <div className="mb-6">
        <label className="block text-sm text-white/60 mb-2">Siz kimsiz?</label>
        <div className="grid grid-cols-2 gap-3">
          {roleBtn("user", User, "Foydalanuvchi", "Trener qidiraman")}
          {roleBtn("trainer", Dumbbell, "Trener", "Shogird qidiraman")}
        </div>
      </div>

      {/* Telegram orqali ro'yxatdan o'tish yangi akkaunt ochadi (oddiy foydalanuvchi); trener tanlangan bo'lsa — keyin "Trener bo'lish" sahifasiga */}
      <TelegramLoginButton redirect={role === "trainer" ? "/become-trainer" : "/trainers"} label="Telegram orqali ro'yxatdan o'tish" />
      <p className="text-center text-xs text-white/40 mt-3 leading-relaxed" data-testid="register-phone-note">Telefon raqamingiz kerak bo'ladi — Telegram botida «📱 Raqamni ulashish» tugmasi bilan bir bosishda tasdiqlanadi. Raqam boshqalarga ko'rinmaydi.</p>

      <p className="text-center text-[11px] text-white/30 mt-4 leading-relaxed">
        Ro'yxatdan o'tib, <Link href="/terms" className="text-white/50 hover:text-lime underline">Foydalanish shartlari</Link> va <Link href="/privacy" className="text-white/50 hover:text-lime underline">Maxfiylik siyosati</Link> bilan tanishganingizni tasdiqlaysiz.
      </p>

      {GOOGLE_LOGIN_ENABLED && (
        <>
          <div className="text-center mt-6">
            <button type="button" onClick={() => setShowOther(!showOther)} aria-expanded={showOther} data-testid="other-methods-toggle" className="text-xs text-white/40 hover:text-white underline">Boshqa usul bilan ro'yxatdan o'tish</button>
          </div>
          {showOther && <div className="mt-4" data-testid="other-methods"><GoogleButton role={role} /></div>}
        </>
      )}

      <p className="text-center text-sm text-white/40 mt-6">Akkauntingiz bormi? <Link href="/login" className="text-lime hover:underline">Kirish</Link></p>
    </div>
  );
}
