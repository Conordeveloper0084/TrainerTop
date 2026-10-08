"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loginSchema, type LoginFormData } from "@/lib/validations";
import { createClient } from "@/lib/supabase/client";
import { safeRedirect } from "@/lib/redirect";
import GoogleButton from "@/components/auth/GoogleButton";
import { GOOGLE_LOGIN_ENABLED } from "@/lib/features";
import ResendEmail from "@/components/auth/ResendEmail";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get("redirect"));
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const errorParam = searchParams.get("error");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = redirect;
      } else {
        setPageReady(true);
      }
    });
  }, [redirect]);

  // Callback/confirm route'lari ?error=... bilan qaytaradi
  useEffect(() => {
    if (errorParam === "google_cancelled") toast.error("Google orqali kirish bekor qilindi");
    else if (errorParam === "confirm_failed") toast.error("Tasdiqlash havolasi eskirgan yoki noto'g'ri. Kirib, yangi xat so'rang");
    else if (errorParam === "auth_failed") toast.error("Kirishda xatolik yuz berdi. Qayta urinib ko'ring");
  }, [errorParam]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });

      if (error) {
        if (error.message.includes("Invalid login")) toast.error("Email yoki parol noto'g'ri");
        else if (error.message.includes("Email not confirmed") || (error as any).code === "email_not_confirmed") {
          setUnconfirmedEmail(data.email);
          toast.error("Emailingiz hali tasdiqlanmagan");
        }
        else if ((error as any).code === "user_banned" || /banned/i.test(error.message)) {
          toast.error("Akkauntingiz bloklangan. Batafsil ma'lumot uchun support botiga yozing: @TrainerTop_Support_Bot", { duration: 9000 });
        }
        else toast.error(error.message);
        setIsLoading(false);
        return;
      }

      toast.success("Muvaffaqiyatli kirdingiz!");
      setTimeout(() => { window.location.href = redirect; }, 500);
    } catch {
      toast.error("Xatolik yuz berdi");
      setIsLoading(false);
    }
  };

  if (!pageReady) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Kirish</h1>
      <p className="text-white/40 text-sm mb-8">Trainertop akkauntingizga kiring</p>

      {unconfirmedEmail && (
        <div className="mb-6 rounded-xl border border-lime/20 bg-lime-muted p-4">
          <p className="text-sm mb-1 font-medium">Emailingiz tasdiqlanmagan</p>
          <p className="text-xs text-white/50 mb-3">{unconfirmedEmail} manziliga yuborilgan xatdagi havolani bosing. Xat topilmasa, qayta yuboring (Spam papkasini ham tekshiring).</p>
          <ResendEmail email={unconfirmedEmail} />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-sm text-white/60 mb-2">Email</label>
          <input {...register("email")} type="email" placeholder="email@example.com" className="input-field" />
          {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-2">Parol</label>
          <div className="relative">
            <input {...register("password")} type={showPassword ? "text" : "password"} placeholder="Parolingiz" className="input-field pr-12" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>}
          <div className="text-right mt-2"><Link href="/forgot-password" className="text-xs text-white/40 hover:text-lime">Parolni unutdingizmi?</Link></div>
        </div>
        <button type="submit" disabled={isLoading} className="btn-lime w-full flex items-center justify-center gap-2 disabled:opacity-50">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? "Yuklanmoqda..." : "Kirish"}
        </button>
      </form>

      {GOOGLE_LOGIN_ENABLED && (
        <>
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-white/10" /><span className="text-xs text-white/30">yoki</span><div className="h-px flex-1 bg-white/10" />
          </div>
          <GoogleButton redirect={redirect} />
        </>
      )}

      <p className="text-center text-sm text-white/40 mt-6">Akkauntingiz yo'qmi? <Link href="/register" className="text-lime hover:underline">Ro'yxatdan o'tish</Link></p>
    </div>
  );
}
