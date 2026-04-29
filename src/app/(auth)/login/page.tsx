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

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

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
        else if (error.message.includes("Email not confirmed")) toast.error("Supabase → Auth → Confirm email → OFF qiling");
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

  const handleGoogle = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}` },
    });
    if (error) toast.error("Google kirish hozircha ishlamaydi");
  };

  if (!pageReady) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Kirish</h1>
      <p className="text-white/40 text-sm mb-8">Trainertop akkauntingizga kiring</p>

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
        </div>
        <button type="submit" disabled={isLoading} className="btn-lime w-full flex items-center justify-center gap-2 disabled:opacity-50">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? "Yuklanmoqda..." : "Kirish"}
        </button>
      </form>

      <p className="text-center text-sm text-white/40 mt-6">Akkauntingiz yo'qmi? <Link href="/register" className="text-lime hover:underline">Ro'yxatdan o'tish</Link></p>
    </div>
  );
}
