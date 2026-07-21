"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Star, MapPin, Users, Loader2, Clock } from "lucide-react";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { cn, getInitials, getSpecializationLabel, getCategoryColor, getWorkTypeLabel, formatRating, formatPrice } from "@/lib/utils";

export default function TrainersPage() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [spec, setSpec] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => { fetchTrainers(); }, []);

  const fetchTrainers = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (spec) params.set("specialization", spec);
      if (city) params.set("city", city);
      const res = await fetch(`/api/trainers?${params}`);
      const data = await res.json();
      setTrainers(Array.isArray(data) ? data : []);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { const t = setTimeout(fetchTrainers, 300); return () => clearTimeout(t); }, [search, spec, city]);

  if (loading) return <div className="container-main py-8"><SkeletonGrid count={6} type="trainer" /></div>;

  return (
    <div className="container-main py-8">
      <div className="mb-8"><h1 className="text-h1 mb-2">Trenerlar</h1><p className="text-white/40 text-sm">O'zbekistonning eng yaxshi fitness trenerlari</p></div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Trener qidirish..." className="input-field !pl-11" /></div>
        <select value={spec} onChange={(e) => setSpec(e.target.value)} className="input-field sm:w-44"><option value="">Yo'nalish</option><option value="fitness">Fitness</option><option value="bodybuilding">Bodybuilding</option><option value="yoga">Yoga</option><option value="diet">Dieta</option><option value="powerlifting">Powerlifting</option><option value="crossfit">CrossFit</option></select>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="input-field sm:w-44"><option value="">Shahar</option><option value="Toshkent">Toshkent</option><option value="Samarqand">Samarqand</option><option value="Buxoro">Buxoro</option><option value="Farg'ona">Farg'ona</option><option value="Namangan">Namangan</option></select>
      </div>
      <p className="text-xs text-white/30 mb-4">{trainers.length} ta trener</p>

      {trainers.length === 0 ? (
        <div className="card p-12 text-center"><Users className="h-10 w-10 text-white/10 mx-auto mb-4" /><p className="text-sm text-white/40">Hali trenerlar yo'q</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trainers.map((t: any) => <TrainerCard key={t.user_id} trainer={t} />)}
        </div>
      )}
    </div>
  );
}

function TrainerCard({ trainer: t }: { trainer: any }) {
  const name = t.profiles?.full_name || "";
  const avatar = t.profiles?.avatar_url;
  const specs = t.specializations || [];

  return (
    <Link href={`/trainers/${t.user_id}`} className="card group overflow-hidden hover:border-lime/20 transition-all duration-300">
      {/* Rasm — faqat rasm, ustida hech narsa yo'q */}
      <div className="w-full aspect-[4/3] bg-dark-card overflow-hidden">
        {avatar ? (
          <img src={avatar} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-dark-card to-dark-elevated">
            <span className="text-5xl font-bold text-white/[0.06]">{getInitials(name)}</span>
          </div>
        )}
      </div>

      {/* Ma'lumotlar — rasm pastida, aniq ko'rinadi */}
      <div className="p-4">
        {/* Ism va reyting */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-base group-hover:text-lime transition-colors">{name}</h3>
          {t.rating > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <Star className="h-3.5 w-3.5 text-lime fill-lime" />
              <span className="text-sm font-semibold">{formatRating(t.rating)}</span>
            </div>
          )}
        </div>

        {/* Shahar, tajriba, obunachilar */}
        <div className="flex items-center gap-3 text-xs text-white/40 mb-3">
          {t.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{t.city}</span>}
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.experience_years} yil</span>
          {t.followers_count > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{t.followers_count}</span>}
        </div>

        {/* Yo'nalishlar */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {specs.slice(0, 3).map((s: string) => (
            <span key={s} className={cn("text-[10px] px-2 py-0.5 rounded-full", getCategoryColor(s))}>{getSpecializationLabel(s)}</span>
          ))}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime/10 text-lime border border-lime/20">{getWorkTypeLabel(t.work_type)}</span>
        </div>

        {/* Narx */}
        {t.monthly_price && (
          <div className="pt-3 border-t border-white/[0.04]">
            <p className="text-[9px] text-white/30 uppercase">Oylik mashq</p>
            <p className="text-sm font-bold text-lime">{formatPrice(t.monthly_price)}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
