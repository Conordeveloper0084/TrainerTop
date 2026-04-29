"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap, Search, BookOpen, MessageCircle, Star, Users,
  Award, ArrowRight, Sparkles, Shield, TrendingUp, Dumbbell,
} from "lucide-react";

// ===== HERO SECTION =====
function HeroSection() {
  const [stats, setStats] = useState({ trainers: 0, lessons: 0, rating: 0 });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/landing-stats");
        if (res.ok) setStats(await res.json());
      } catch {}
    })();
  }, []);

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-lime/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime/20 to-transparent" />
      </div>

      <div className="container-main relative z-10 pt-24 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-lime-muted border border-lime/20 rounded-full px-4 py-1.5 mb-8 animate-fade-in-up">
            <Sparkles className="h-3.5 w-3.5 text-lime" />
            <span className="text-xs font-medium text-lime">
              O'zbekistonning #1 fitness platformasi
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] mb-6 animate-fade-in-up animate-delay-100">
            O'z{" "}
            <span className="relative">
              <span className="text-lime">treneringni</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6C50 2 150 2 198 6" stroke="#B4FF00" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
              </svg>
            </span>{" "}
            top
          </h1>

          <p className="text-lg text-white/50 max-w-xl mx-auto mb-10 leading-relaxed animate-fade-in-up animate-delay-200">
            Ishonchli fitness trener toping, professional darsliklar sotib oling,
            AI assistant bilan mashq rejangizni tuzing
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animate-delay-300">
            <Link href="/trainers" className="btn-lime flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              Trener topish
            </Link>
            <Link href="/register?role=trainer" className="btn-outline flex items-center gap-2 text-base">
              <Dumbbell className="h-4 w-4" />
              Men trenerman
            </Link>
          </div>

          <div className="flex items-center justify-center gap-8 sm:gap-12 mt-14 animate-fade-in-up animate-delay-400">
            <div className="text-center">
              <p className="text-2xl font-bold text-lime">{stats.trainers > 10 ? `${stats.trainers}+` : "50+"}</p>
              <p className="text-xs text-white/30 mt-1">Trenerlar</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-bold text-lime">{stats.lessons > 5 ? `${stats.lessons}+` : "10+"}</p>
              <p className="text-xs text-white/30 mt-1">Darsliklar</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-bold text-lime">{stats.rating > 0 ? stats.rating.toFixed(1) : "4.8"}</p>
              <p className="text-xs text-white/30 mt-1">O'rtacha reyting</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== HOW IT WORKS =====
function HowItWorks() {
  const steps = [
    { step: "01", title: "Trener tanlang", description: "Yo'nalish, lokatsiya, reyting bo'yicha o'zingizga mos trener toping", icon: Search },
    { step: "02", title: "Bog'laning", description: "Trener bilan chat orqali muloqot qiling, savollaringizni bering", icon: MessageCircle },
    { step: "03", title: "Mashq boshlang", description: "Darslik sotib oling yoki shaxsiy mashg'ulot uchun yoziling", icon: Dumbbell },
  ];

  return (
    <section className="section border-t border-white/[0.06]">
      <div className="container-main">
        <div className="text-center mb-14">
          <p className="text-lime text-xs font-semibold tracking-widest uppercase mb-3">Qanday ishlaydi</p>
          <h2 className="text-h1">3 qadam bilan boshlang</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((item) => (
            <div key={item.step} className="card-hover p-6 group">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lime-muted group-hover:bg-lime/20 transition-colors">
                  <item.icon className="h-5 w-5 text-lime" />
                </div>
                <span className="text-3xl font-bold text-white/[0.06]">{item.step}</span>
              </div>
              <h3 className="text-h3 mb-2">{item.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== FEATURES =====
function Features() {
  const features = [
    { icon: Shield, title: "Ishonchli trenerlar", description: "Har bir trener tekshirilgan, reytinglari va sharhlari bor" },
    { icon: BookOpen, title: "Professional darsliklar", description: "Mashq rejalari, ovqatlanish, texnikalar — hammasini bir joydan" },
    { icon: Sparkles, title: "AI assistant", description: "Sun'iy intellekt sizga shaxsiy mashq va dieta maslahat beradi" },
    { icon: TrendingUp, title: "Natijalar galereyasi", description: "Before/after rasmlar — trener sifatini o'z ko'zingiz bilan ko'ring" },
    { icon: MessageCircle, title: "Tezkor chat", description: "Treneringiz bilan to'g'ridan-to'g'ri muloqot qiling" },
    { icon: Award, title: "Reyting tizimi", description: "Haqiqiy sharhlar va reytinglar — eng yaxshisini tanlang" },
  ];

  return (
    <section className="section border-t border-white/[0.06]">
      <div className="container-main">
        <div className="text-center mb-14">
          <p className="text-lime text-xs font-semibold tracking-widest uppercase mb-3">Imkoniyatlar</p>
          <h2 className="text-h1">Nima uchun aynan Trainertop?</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => (
            <div key={feature.title} className="card-hover p-6 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-subtle group-hover:bg-lime-muted transition-colors mb-4">
                <feature.icon className="h-5 w-5 text-lime/70 group-hover:text-lime transition-colors" />
              </div>
              <h3 className="font-semibold text-[15px] mb-1.5">{feature.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== TOP TRAINERS =====
function TopTrainers() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/trainers");
        const data = await res.json();
        setTrainers(Array.isArray(data) ? data.slice(0, 4) : []);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  if (loading || trainers.length === 0) return null;

  return (
    <section className="section border-t border-white/[0.06]">
      <div className="container-main">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-lime text-xs font-semibold tracking-widest uppercase mb-3">Top trenerlar</p>
            <h2 className="text-h1">Eng yaxshi trenerlar</h2>
          </div>
          <Link href="/trainers" className="hidden sm:flex items-center gap-1.5 text-sm text-white/40 hover:text-lime transition-colors">
            Hammasini ko'rish <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {trainers.map((t: any) => (
            <Link key={t.user_id} href={`/trainers/${t.user_id}`} className="card-hover p-5 group">
              <div className="w-full aspect-square rounded-xl bg-dark-card mb-4 flex items-center justify-center group-hover:bg-dark-elevated transition-colors overflow-hidden">
                {t.profiles?.avatar_url ? <img src={t.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl font-bold text-white/[0.08]">{(t.profiles?.full_name || "T").charAt(0)}</span>}
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="font-semibold text-sm truncate pr-2">{t.profiles?.full_name}</h3>
                {t.rating > 0 && <div className="flex items-center gap-1 shrink-0"><Star className="h-3 w-3 text-lime fill-lime" /><span className="text-xs text-white/60">{t.rating}</span></div>}
              </div>
              <p className="text-xs text-white/40 mb-3">{(t.specializations || [])[0] || "Fitness"} · {t.experience_years} yil tajriba</p>
              <div className="flex items-center gap-2">
                {(t.specializations || []).slice(0, 1).map((s: string) => <span key={s} className="badge text-[10px] px-2 py-0.5 bg-lime/10 text-lime">{s}</span>)}
                <span className="badge-lime text-[10px] px-2 py-0.5">{t.work_type === "online" ? "Online" : t.work_type === "offline" ? "Offline" : "Online va Offline"}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="sm:hidden mt-6 text-center">
          <Link href="/trainers" className="btn-outline inline-flex items-center gap-2 !py-2.5 text-sm">
            Barcha trenerlar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ===== CTA SECTION =====
function CTASection() {
  return (
    <section className="section border-t border-white/[0.06]">
      <div className="container-main">
        <div className="relative overflow-hidden rounded-2xl bg-dark-surface border border-white/[0.06] p-8 sm:p-12 md:p-16 text-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-lime/[0.06] rounded-full blur-[80px]" />
          <div className="relative z-10">
            <h2 className="text-h1 sm:text-3xl mb-4">Trener sifatida qo'shiling</h2>
            <p className="text-white/40 max-w-lg mx-auto mb-8 text-sm leading-relaxed">
              O'z profilingizni oching, darsliklar yarating, yangi shogirdlar toping.
              Trainertop sizning professional platformangiz.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register?role=trainer" className="btn-lime flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Hozir boshlash
              </Link>
              <Link href="/trainers" className="btn-ghost flex items-center gap-2">
                <Users className="h-4 w-4" />
                Trenerlarni ko'rish
              </Link>
            </div>
            <div className="flex items-center justify-center gap-6 mt-10">
              <div className="flex items-center gap-2 text-white/30">
                <Shield className="h-4 w-4" /><span className="text-xs">Xavfsiz to'lov</span>
              </div>
              <div className="flex items-center gap-2 text-white/30">
                <Users className="h-4 w-4" /><span className="text-xs">500+ foydalanuvchi</span>
              </div>
              <div className="flex items-center gap-2 text-white/30">
                <Star className="h-4 w-4" /><span className="text-xs">4.8 o'rtacha reyting</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== MAIN PAGE =====
export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <HowItWorks />
      <TopTrainers />
      <Features />
      <CTASection />
    </>
  );
}
