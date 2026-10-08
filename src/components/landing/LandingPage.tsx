"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search, MessageCircle, Star, ArrowRight, Sparkles,
  Shield, Dumbbell, BookOpen, Zap, CheckCircle2, Play,
} from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";
import { AthleteBadge } from "@/components/ui/AthleteBadge";
import { PlatformReviewsSection } from "@/components/reviews/PlatformReviewsSection";
import { TopTrainersCarousel, type CarouselTrainer } from "./TopTrainersCarousel";

// Unsplash professional fitness rasmlari (bepul, litsenziyasiz)
const IMG = {
  hero: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=80&auto=format&fit=crop",
  gym: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80&auto=format&fit=crop",
  yoga: "https://images.unsplash.com/photo-1588286840104-8957b019727f?w=800&q=80&auto=format&fit=crop",
  cardio: "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=800&q=80&auto=format&fit=crop",
  strength: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80&auto=format&fit=crop",
  boxing: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&q=80&auto=format&fit=crop",
  crossfit: "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=800&q=80&auto=format&fit=crop",
  trainer: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80&auto=format&fit=crop",
  lessons: "https://images.unsplash.com/photo-1591258370814-01609b341790?w=800&q=80&auto=format&fit=crop",
  cta: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1200&q=80&auto=format&fit=crop",
};

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
    <section className="relative min-h-[92vh] flex items-center overflow-hidden">
      {/* Fon rasm + gradient overlay */}
      <div className="absolute inset-0 z-0">
        <img src={IMG.hero} alt="" className="w-full h-full object-cover animate-slow-zoom" />
        {/* Umumiy yengil qoraytirish */}
        <div className="absolute inset-0 bg-black/40" />
        {/* Chapdan kuchli to'q gradient — matn joyi aniq bo'lishi uchun (asosiy) */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
        {/* Pastdan to'q gradient — statistika o'qilishi uchun */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-transparent to-transparent" />
        {/* Yuqoridan yengil — navbar joyi */}
        <div className="absolute inset-0 bg-gradient-to-b from-dark-bg/40 to-transparent" />
        <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-lime/[0.06] rounded-full blur-[120px]" />
      </div>

      <div className="container-main relative z-10 pt-24 pb-16 on-image">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-lime-muted border border-lime/20 rounded-full px-4 py-1.5 mb-6 animate-fade-in-up">
            <Sparkles className="h-3.5 w-3.5 text-lime" />
            <span className="text-xs font-medium text-lime">O'zbekistonning #1 fitness platformasi</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6 animate-fade-in-up animate-delay-100 [text-shadow:0_2px_30px_rgba(0,0,0,0.9),0_1px_4px_rgba(0,0,0,0.8)]">
            O'z{" "}
            <span className="relative inline-block">
              <span className="text-lime">treneringni</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6C50 2 150 2 198 6" stroke="#B4FF00" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
              </svg>
            </span>{" "}
            top
          </h1>

          <p className="text-lg sm:text-xl text-white/90 max-w-lg mb-8 leading-relaxed animate-fade-in-up animate-delay-200 [text-shadow:0_2px_16px_rgba(0,0,0,0.9),0_1px_3px_rgba(0,0,0,0.7)]">
            Ishonchli fitness trener toping, professional video darsliklar
            sotib oling, AI yordamchi bilan mashq rejangizni tuzing
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-4 animate-fade-in-up animate-delay-300">
            <Link href="/trainers" className="btn-lime flex items-center gap-2 text-base w-full sm:w-auto justify-center">
              <Search className="h-4 w-4" />Trener topish
            </Link>
            <Link href="/register?role=trainer" className="flex items-center gap-2 text-base w-full sm:w-auto justify-center bg-white/10 backdrop-blur-sm border border-white/25 text-white px-6 py-3 rounded-button transition-all hover:bg-white/20 active:scale-[0.98]">
              <Dumbbell className="h-4 w-4" />Men trenerman
            </Link>
          </div>

          <div className="flex items-center gap-8 sm:gap-12 mt-14 animate-fade-in-up animate-delay-400">
            <div>
              <p className="text-3xl font-bold text-lime">{stats.trainers > 10 ? `${stats.trainers}+` : "50+"}</p>
              <p className="text-xs text-white/40 mt-1">Trenerlar</p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div>
              <p className="text-3xl font-bold text-lime">{stats.lessons > 5 ? `${stats.lessons}+` : "10+"}</p>
              <p className="text-xs text-white/40 mt-1">Darsliklar</p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div>
              <p className="text-3xl font-bold text-lime">{stats.rating > 0 ? stats.rating.toFixed(1) : "4.8"}</p>
              <p className="text-xs text-white/40 mt-1">O'rtacha reyting</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 hidden sm:block">
        <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5">
          <div className="w-1 h-2 rounded-full bg-lime animate-float" />
        </div>
      </div>
    </section>
  );
}

// ===== SPORT TURLARI =====
function SportTypes() {
  const sports = [
    { name: "Bodybuilding", img: IMG.strength, desc: "Mushak yig'ish" },
    { name: "Yoga", img: IMG.yoga, desc: "Egiluvchanlik va tinchlik" },
    { name: "Cardio", img: IMG.cardio, desc: "Chidamlilik va ozish" },
    { name: "Boks", img: IMG.boxing, desc: "Jang san'ati" },
    { name: "CrossFit", img: IMG.crossfit, desc: "Kuch va tezlik" },
    { name: "Gym", img: IMG.gym, desc: "Umumiy tayyorgarlik" },
  ];

  return (
    <section className="section border-t border-white/[0.06]">
      <div className="container-main">
        <div className="text-center mb-12 reveal">
          <p className="text-lime text-xs font-semibold tracking-widest uppercase mb-3">Yo'nalishlar</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Har qanday sport uchun trener</h2>
          <p className="text-white/40 mt-3 max-w-lg mx-auto">
            Qaysi sport bilan shug'ullansangiz ham, o'zingizga mos professional trener topasiz
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {sports.map((sport, i) => (
            <Link key={sport.name} href="/trainers"
              className="group relative aspect-[4/5] rounded-2xl overflow-hidden reveal"
              style={{ transitionDelay: `${i * 60}ms` }}>
              <img src={sport.img} alt={sport.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 on-image">
                <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-lime transition-colors [text-shadow:0_2px_12px_rgba(0,0,0,0.8)]">{sport.name}</h3>
                <p className="text-xs text-white/80 mt-0.5 [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">{sport.desc}</p>
              </div>
              <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-lime/90 flex items-center justify-center opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                <ArrowRight className="h-4 w-4 text-black" />
              </div>
            </Link>
          ))}
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
        <div className="text-center mb-14 reveal">
          <p className="text-lime text-xs font-semibold tracking-widest uppercase mb-3">Qanday ishlaydi</p>
          <h2 className="text-3xl sm:text-4xl font-bold">3 qadam bilan boshlang</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((item, i) => (
            <div key={item.step} className="relative card p-8 reveal" style={{ transitionDelay: `${i * 100}ms` }}>
              <span className="text-6xl font-bold text-lime/10 absolute top-4 right-5">{item.step}</span>
              <div className="w-12 h-12 rounded-xl bg-lime-muted flex items-center justify-center mb-5">
                <item.icon className="h-6 w-6 text-lime" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
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
    { icon: Shield, title: "Ishonchli trenerlar", description: "Har bir trener tekshiruvdan o'tadi. Reyting va sharhlar bilan tanlang" },
    { icon: BookOpen, title: "Video darsliklar", description: "Professional video kurslar. Istalgan vaqtda, istalgan joyda ko'ring" },
    { icon: MessageCircle, title: "To'g'ridan chat", description: "Trener bilan bevosita muloqot. Savollar, maslahat, qo'llab-quvvatlash" },
    { icon: Zap, title: "AI yordamchi", description: "Sun'iy intellekt sizga mashq va ovqatlanish bo'yicha maslahat beradi" },
  ];

  return (
    <section className="section border-t border-white/[0.06]">
      <div className="container-main">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative reveal">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden">
              <img src={IMG.trainer} alt="Professional trener" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-6 right-2 sm:right-6 bg-dark-surface border border-white/10 rounded-2xl p-4 shadow-2xl max-w-[200px]">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex -space-x-1">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="w-6 h-6 rounded-full bg-lime/20 border-2 border-dark-surface flex items-center justify-center">
                      <Star className="h-2.5 w-2.5 text-lime fill-lime" />
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-sm font-semibold">1000+ mamnun mijoz</p>
              <p className="text-xs text-white/40">bizga ishonadi</p>
            </div>
          </div>

          <div>
            <p className="text-lime text-xs font-semibold tracking-widest uppercase mb-3 reveal">Nima uchun biz</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-8 reveal">Nima uchun aynan Trainertop?</h2>
            <div className="space-y-5">
              {features.map((feature, i) => (
                <div key={feature.title} className="flex gap-4 reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="w-11 h-11 rounded-xl bg-lime-muted flex items-center justify-center shrink-0">
                    <feature.icon className="h-5 w-5 text-lime" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-1">{feature.title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== VIDEO DARSLIKLAR (YANGI) =====
function LessonsSection() {
  return (
    <section className="section border-t border-white/[0.06]">
      <div className="container-main">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Chap: matn */}
          <div>
            <p className="text-lime text-xs font-semibold tracking-widest uppercase mb-3 reveal">Video darsliklar</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-5 reveal">
              Professional darsliklarni <span className="text-lime">sotib oling</span> va ko'ring
            </h2>
            <p className="text-white/50 mb-8 leading-relaxed reveal">
              Trenerlarning va TrainerTop platformasining premium video kurslarini
              xarid qiling. Istalgan vaqtda, istalgan joyda tomosha qiling —
              telefon yoki kompyuterда.
            </p>
            <div className="space-y-4 mb-8">
              {[
                { icon: BookOpen, title: "Turli darsliklar", desc: "Bodybuilding, yoga, ozish va boshqa yo'nalishlar" },
                { icon: Play, title: "HD video sifat", desc: "Har bir mashqni aniq ko'rsatmalar bilan o'rganing" },
                { icon: CheckCircle2, title: "Umrbod kirish", desc: "Bir marta sotib oling, cheksiz ko'ring" },
              ].map((item, i) => (
                <div key={item.title} className="flex gap-4 reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="w-11 h-11 rounded-xl bg-lime-muted flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5 text-lime" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-0.5">{item.title}</h3>
                    <p className="text-sm text-white/40">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/lessons" className="btn-lime inline-flex items-center gap-2 reveal">
              <BookOpen className="h-4 w-4" />Darsliklarni ko'rish
            </Link>
          </div>

          {/* O'ng: rasm */}
          <div className="relative reveal order-first lg:order-last">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden">
              <img src={IMG.lessons} alt="Video darsliklar" className="w-full h-full object-cover" />
              {/* Play tugmasi overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-lime/90 flex items-center justify-center shadow-2xl">
                  <Play className="h-7 w-7 text-black fill-black ml-1" />
                </div>
              </div>
              <div className="absolute inset-0 bg-black/20" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== TOP TRAINERS =====
// ===== TOP TRENERLAR (admin tanlagan; hali tanlanmagan bo'lsa — namunaviy) =====
const MOCK_TRAINERS: CarouselTrainer[] = [
  { id: "mock-1", name: "Aziz Rahimov", avatar_url: null, specialization: "strength", rating: null, blurb: null, href: null },
  { id: "mock-2", name: "Malika Yusupova", avatar_url: null, specialization: "yoga", rating: null, blurb: null, href: null },
  { id: "mock-3", name: "Sardor Tosh", avatar_url: null, specialization: "boxing", rating: null, blurb: null, href: null },
  { id: "mock-4", name: "Dilnoza Karimova", avatar_url: null, specialization: "cardio", rating: null, blurb: null, href: null },
];

function TopTrainers() {
  const [items, setItems] = useState<CarouselTrainer[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/trainers/featured");
        const data = res.ok ? await res.json() : [];
        const list: CarouselTrainer[] = Array.isArray(data) && data.length > 0
          ? data.map((t: any) => ({
              id: t.user_id, name: t.profiles?.full_name || "Trener", avatar_url: t.profiles?.avatar_url || null,
              specialization: t.specializations?.[0] || null, rating: t.rating || null, blurb: t.featured_blurb || null,
              href: `/trainers/${t.user_id}`, verified: !!t.is_verified,
            }))
          : MOCK_TRAINERS;
        setItems(list);
      } catch { setItems(MOCK_TRAINERS); }
    })();
  }, []);

  return (
    <section className="section border-t border-white/[0.06]">
      <div className="container-main">
        <div className="flex items-end justify-between mb-10 reveal">
          <div>
            <p className="text-lime text-xs font-semibold tracking-widest uppercase mb-3">Top trenerlar</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Eng yaxshi trenerlar</h2>
          </div>
          <Link href="/trainers" className="text-sm text-lime hover:underline flex items-center gap-1 shrink-0">
            Barchasi <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {items === null ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="card p-4">
                <div className="aspect-square rounded-xl bg-white/[0.04] mb-3 animate-pulse" />
                <div className="h-4 bg-white/[0.04] rounded w-2/3 animate-pulse" />
                <div className="h-3 bg-white/[0.04] rounded w-1/2 mt-2 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <TopTrainersCarousel items={items} />
        )}
      </div>
    </section>
  );
}

// ===== CTA SECTION =====
function CTASection() {
  return (
    <section className="section border-t border-white/[0.06]">
      <div className="container-main">
        <div className="relative rounded-3xl overflow-hidden reveal">
          <img src={IMG.cta} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-dark-bg via-dark-bg/90 to-dark-bg/60" />

          <div className="relative z-10 px-6 py-14 sm:px-14 sm:py-20 max-w-xl on-image">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 [text-shadow:0_2px_16px_rgba(0,0,0,0.7)]">
              Trener sifatida <span className="text-lime">qo'shiling</span>
            </h2>
            <p className="text-white/80 mb-8 leading-relaxed [text-shadow:0_1px_10px_rgba(0,0,0,0.7)]">
              O'z bilimingizni ulashing, shogirdlar toping, darslik soting va
              daromad qiling. Ro'yxatdan o'tish bepul.
            </p>
            <ul className="space-y-3 mb-8">
              {["Bepul profil oching", "Video darslik soting", "Faqat 10% komissiya"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                  <CheckCircle2 className="h-5 w-5 text-lime shrink-0" />{item}
                </li>
              ))}
            </ul>
            <Link href="/register?role=trainer" className="btn-lime inline-flex items-center gap-2">
              <Dumbbell className="h-4 w-4" />Hoziroq boshlang
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== ASOSIY =====
export default function LandingPage() {
  useScrollReveal();

  return (
    <>
      <HeroSection />
      <SportTypes />
      <HowItWorks />
      <Features />
      <LessonsSection />
      {/* TopTrainers va PlatformReviewsSection vaqtincha o'chirilgan — real trener/baho yetarli bo'lganda qaytariladi */}
      <CTASection />
    </>
  );
}
