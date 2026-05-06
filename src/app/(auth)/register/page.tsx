"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Dumbbell, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { registerSchema, type RegisterFormData } from "@/lib/validations";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const searchParams = useSearchParams();
  const roleFromUrl = searchParams.get("role");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = "/";
      else setPageReady(true);
    });
  }, []);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: roleFromUrl === "trainer" ? "trainer" : "user" },
  });

  const selectedRole = watch("role");

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.full_name, role: data.role } },
      });

      if (error) {
        toast.error(error.message.includes("already registered") ? "Bu email allaqachon ro'yxatdan o'tgan" : error.message);
        setIsLoading(false);
        return;
      }

      // Supabase mavjud emailga identities bo'sh qaytaradi
      if (authData.user?.identities?.length === 0) {
        toast.error("Bu email allaqachon ro'yxatdan o'tgan. Kirish sahifasidan kiring.");
        setIsLoading(false);
        return;
      }

      toast.success("Muvaffaqiyatli ro'yxatdan o'tdingiz!");
      const url = data.role === "trainer" ? "/profile" : "/trainers";
      setTimeout(() => { window.location.replace(url); }, 1000);
    } catch {
      toast.error("Xatolik yuz berdi");
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast.error("Google kirish hozircha ishlamaydi");
  };

  if (!pageReady) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{selectedRole === "trainer" ? "Trener sifatida ro'yxatdan o'ting" : "Ro'yxatdan o'tish"}</h1>
      <p className="text-white/40 text-sm mb-8">{selectedRole === "trainer" ? "Profilingizni oching, shogirdlar toping" : "Trainertop platformasiga qo'shiling"}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-sm text-white/60 mb-2">Siz kimsiz?</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setValue("role", "user")} className={cn("flex flex-col items-center gap-2 p-4 rounded-xl border transition-all", selectedRole === "user" ? "border-lime bg-lime-muted" : "border-white/10 bg-dark-surface hover:border-white/20")}>
              <User className={cn("h-6 w-6", selectedRole === "user" ? "text-lime" : "text-white/40")} />
              <span className={cn("text-sm font-medium", selectedRole === "user" ? "text-lime" : "text-white/60")}>Foydalanuvchi</span>
              <span className="text-[10px] text-white/30">Trener qidiraman</span>
            </button>
            <button type="button" onClick={() => setValue("role", "trainer")} className={cn("flex flex-col items-center gap-2 p-4 rounded-xl border transition-all", selectedRole === "trainer" ? "border-lime bg-lime-muted" : "border-white/10 bg-dark-surface hover:border-white/20")}>
              <Dumbbell className={cn("h-6 w-6", selectedRole === "trainer" ? "text-lime" : "text-white/40")} />
              <span className={cn("text-sm font-medium", selectedRole === "trainer" ? "text-lime" : "text-white/60")}>Trener</span>
              <span className="text-[10px] text-white/30">Shogird qidiraman</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">To'liq ismingiz</label>
          <input {...register("full_name")} type="text" placeholder="Ismingiz Familiyangiz" className="input-field" />
          {errors.full_name && <p className="text-red-400 text-xs mt-1.5">{errors.full_name.message}</p>}
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-2">Email</label>
          <input {...register("email")} type="email" placeholder="email@example.com" className="input-field" />
          {errors.email && <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-2">Parol</label>
          <div className="relative">
            <input {...register("password")} type={showPassword ? "text" : "password"} placeholder="Kamida 6 ta belgi" className="input-field pr-12" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>}
        </div>
        <button type="submit" disabled={isLoading} className="btn-lime w-full flex items-center justify-center gap-2 disabled:opacity-50">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? "Yuklanmoqda..." : "Ro'yxatdan o'tish"}
        </button>
      </form>

      <p className="text-center text-sm text-white/40 mt-6">Akkauntingiz bormi? <Link href="/login" className="text-lime hover:underline">Kirish</Link></p>
    </div>
  );
}
